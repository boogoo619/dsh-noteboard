import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerIntelligence } from '../src/intelligence.mjs'
import { buildApi } from '../src/commands.mjs'

// Pass the installed dsh package directory to verify its actual schema and session contracts.
if (!process.argv[2]) throw new Error('Usage: node test/host-extraction.mjs <installed-dsh-package-directory>')
const hostRequire = createRequire(join(resolve(process.argv[2]), 'package.json'))
const { assertSupportedJsonSchema, validateJsonSchemaValue } = await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/dsh-tools')).href)
const { Session } = await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/dsh-session')).href)
const root = await mkdtemp(join(tmpdir(), 'nb-host-extract-'))
try {
  const registry = new Map(), skills = new Map()
  registerIntelligence({ inject(_names, use) { use({ effect: (run) => run(), tools: { register(tool) {
    assertSupportedJsonSchema(tool.parameters); assertSupportedJsonSchema(tool.output.schema); registry.set(tool.name, tool)
  } }, skills: { register: (skill) => skills.set(skill.name, skill) } }) } }, buildApi())
  const session = Session.create('extraction-check')
  session.append('user/message', { id: 'message-user', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Ship beta first' }] }, { surfaceOp: 'append' })
  session.append('assistant/message', { turn: 0, step: 0, message: { id: 'message-assistant', role: 'assistant', source: { kind: 'model', provider: 'fixture', model: 'fixture' }, content: [{ type: 'text', text: 'Decision recorded' }] } }, { surfaceOp: 'append' })
  const exec = { agent: { session: { id: session.id, header: { cwd: root }, snapshotEvents: () => session.snapshotEvents() } } }
  const run = async (name, args) => {
    const tool = registry.get(name)
    assert.deepEqual(validateJsonSchemaValue(tool.parameters, args), [])
    const result = await tool.execute(args, exec)
    assert.deepEqual(validateJsonSchemaValue(tool.output.schema, result), [])
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
    return result
  }
  const page = await run('noteboard_read_session', {})
  assert.equal(page.complete, true)
  assert.deepEqual(page.messages.map(({ role, seq }) => ({ role, seq })), [{ role: 'user', seq: 0 }, { role: 'assistant', seq: 1 }])
  const args = { canvasName: 'Main', deduplicate: true, notes: [{ title: 'Beta first', body: 'Release the beta first.', source: page.messages[0].source }] }
  const created = await run('noteboard_create', args)
  const retry = await run('noteboard_create', args)
  assert.equal(retry.skipped[0].id, created.note.id)
  assert.equal(retry.notes.length, 0)
  const saved = await run('noteboard_query', { ids: created.succeeded })
  assert.equal(saved.notes[0].source.seq, '0')
  assert.deepEqual(validateJsonSchemaValue(registry.get('canvas_add_note').parameters, { title: 'Round trip', body: 'A', source: saved.notes[0].source }), [])
  await run('noteboard_restore', { id: created.operationId })
  assert.equal((await run('noteboard_query', {})).notes.length, 0)
  console.log(JSON.stringify({ schemas: registry.size, skills: skills.size, realHostMessages: page.messages.length, sourceRoundTrip: true, duplicateRetry: true, restored: true }))
} finally {
  await rm(root, { recursive: true, force: true })
}
