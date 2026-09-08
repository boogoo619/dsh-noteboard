import { beforeEach, afterEach, it, expect } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApi } from '../src/commands.mjs'
import { registerIntelligence } from '../src/intelligence.mjs'
let root, tools, skills, api, sessionQuery
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'nb-tools-')); api = buildApi(); tools = new Map(); skills = new Map()
  sessionQuery = undefined
  registerIntelligence({ get: () => sessionQuery, inject(names, use) { use({ effect: (run) => run(), tools: { register: (tool) => tools.set(tool.name, tool) }, skills: { register: (skill) => skills.set(skill.name, skill) } }) } }, api)
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
const run = (name, args) => tools.get(name).execute(args, { agent: { session: { header: { cwd: root } } } })
it('registers five model/user workflows and twelve tools', () => {
  expect(tools.size).toBe(12); expect(skills.size).toBe(5)
  for (const skill of skills.values()) expect(skill.invocation).toEqual({ modelInvocable: true, userInvocable: true })
  expect(tools.get('noteboard_layout').parameters.properties.action.enum).toContain('ordered')
  expect(tools.get('noteboard_update').parameters.properties.patch.properties.color.enum).toContain('green')
})
it('reads source messages through the host and batch-creates recoverable notes with provenance', async () => {
  sessionQuery = { async readSession(id) {
    return { session: { id, cwd: root }, events: [{ seq: 0, time: 100, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'Ship the beta first.' }] } }] }
  } }
  const page = await run('noteboard_read_session', { sessionId: 'planning' })
  expect(page.complete).toBe(true)
  const created = await run('noteboard_create', { canvasName: 'Main', source: page.messages[0].source, deduplicate: true, notes: [
    { title: 'Beta first', body: 'Ship the beta before the stable release.' },
    { title: 'File evidence', body: 'Documented release order.', source: { path: 'docs/plan.md', startLine: 5, endLine: 8, label: 'Release plan', text: 'Beta before stable' } },
  ] })
  const saved = await run('noteboard_query', { ids: created.succeeded })
  expect(saved.notes.find((n) => n.title === 'Beta first').source).toEqual({ ...page.messages[0].source, seq: '0' })
  expect(saved.notes.find((n) => n.title === 'File evidence').source).toMatchObject({ path: 'docs/plan.md', startLine: 5, endLine: 8 })
  await run('noteboard_restore', { id: created.operationId })
  expect((await run('noteboard_query', {})).notes).toEqual([])
})
it('preserves structured single-note sources and the legacy sessionId shorthand', async () => {
  const source = { sessionId: 'original', seq: 0, label: 'Decision', text: 'Yes', fragments: [{ key: 'user:0', seq: 0, text: 'Yes', prefix: '', suffix: '', start: 0, end: 3 }] }
  const created = await run('canvas_add_note', { title: 'A', body: 'Yes', source, sessionId: 'fallback' })
  expect(created.note.source).toEqual(source)
  const legacy = await run('canvas_add_note', { title: 'B', body: 'Old caller', sessionId: 'old', sourceLabel: 'Old source' })
  expect(legacy.note.source).toEqual({ sessionId: 'old', label: 'Old source' })
})
it('skips exact duplicates in the target canvas and batch without changing existing notes', async () => {
  const args = { canvasName: 'Main', deduplicate: true, notes: [{ title: 'Decision', body: 'Beta first' }, { title: ' Decision ', body: ' Beta first ' }] }
  const first = await run('noteboard_create', args)
  expect(first.notes).toHaveLength(1)
  expect(first.skipped).toEqual([{ index: 1, id: first.note.id, reason: 'duplicate' }])
  const before = await run('noteboard_query', {})
  const retry = await run('noteboard_create', args)
  expect(retry.notes).toEqual([])
  expect(retry.skipped).toHaveLength(2)
  expect(JSON.parse(JSON.stringify(retry))).toStrictEqual(retry)
  expect((await run('noteboard_query', {})).canvasVersion).toBe(before.canvasVersion)
  expect((await run('noteboard_query', {})).notes).toEqual(before.notes)
  await run('noteboard_remove', { canvasName: 'Main', canvasVersion: before.canvasVersion, ids: first.succeeded })
  expect((await run('noteboard_create', args)).notes).toHaveLength(1)
  expect((await run('noteboard_create', { ...args, deduplicate: false })).notes).toHaveLength(2)
})
it('validates all source metadata before creating any notes', async () => {
  for (const source of ['bad', { seq: -1 }, { seq: true }, { startLine: 8, endLine: 3 }, { url: 'javascript:alert(1)' }, { fragments: [{ key: 'x', text: 'bad', start: 5, end: 2 }] }]) {
    await expect(run('noteboard_create', { canvasName: 'Main', notes: [{ title: 'Valid', body: 'A' }, { title: 'Invalid', body: 'B', source }] })).rejects.toThrow()
    expect((await run('noteboard_query', {})).notes).toEqual([])
  }
  await expect(run('noteboard_read_session', { sessionId: 'missing' })).rejects.toThrow('sessionQuery')
  await expect(run('noteboard_sessions', {})).rejects.toThrow('sessionQuery')
})
it('keeps ordered layout scoped and recoverable, rejecting invalid and stale selections', async () => {
  const made = await run('noteboard_create', { canvasName: 'Main', notes: [
    { title: 'later', body: 'B' }, { title: 'earlier', body: 'A' }, { title: 'unrelated', body: 'C' },
  ] })
  const ids = made.notes.slice(0, 2).map((n) => n.id).reverse()
  await run('noteboard_save_as', { canvasName: 'Main', name: 'Other' })
  const before = await run('noteboard_query', { canvasName: 'Main' })
  const args = { canvasName: 'Main', canvasVersion: before.canvasVersion, ids, action: 'ordered', columns: 1 }
  const unrelated = before.canvas.nodes.find((n) => n.id === made.notes[2].id)
  const result = await run('noteboard_layout', args)
  const after = await run('noteboard_query', { canvasName: 'Main' })
  expect(after.canvas.nodes.find((n) => n.id === unrelated.id)).toEqual(unrelated)
  expect((await run('noteboard_query', { canvasName: 'Other' })).canvas).toEqual(before.canvas)
  await expect(run('noteboard_layout', args)).rejects.toThrow('已被修改')
  const current = { ...args, canvasVersion: after.canvasVersion }
  for (const invalid of [{ ids: [] }, { ids: [ids[0], ids[0]] }, { ids: ['missing'] }, { columns: 0 }, { canvasVersion: undefined }]) {
    await expect(run('noteboard_layout', { ...current, ...invalid })).rejects.toThrow()
    expect((await run('noteboard_query', { canvasName: 'Main' })).canvas).toEqual(after.canvas)
  }
  await run('noteboard_restore', { id: result.operationId })
  expect((await run('noteboard_query', { canvasName: 'Main' })).canvas).toEqual(before.canvas)
  const removed = await run('noteboard_remove', { ...args, ids: [ids[0]] })
  const offBoard = await run('noteboard_query', { canvasName: 'Main' })
  await expect(run('noteboard_layout', { ...args, canvasVersion: offBoard.canvasVersion })).rejects.toThrow('不在指定画布')
  await run('noteboard_restore', { id: removed.operationId })
})
it('supports query, derived creation, update, layout, differences and conflict-safe recovery', async () => {
  const created = await run('noteboard_create', { canvasName: 'Main', notes: [{ title: 'A', body: 'fast' }, { title: 'B', body: 'stable' }, { title: 'C', body: 'simple' }] })
  const ids = created.notes.map((n) => n.id)
  const comparison = await run('noteboard_create', { canvasName: 'Main', notes: [{ title: 'Comparison', body: 'Tradeoffs', derivedFrom: ids }] })
  const id = comparison.note.id
  let state = await run('noteboard_query', { ids: [id] })
  expect(state.notes[0].derivedFrom).toEqual(ids)
  const update = await run('noteboard_update', { ids: [id], versions: { [id]: state.notes[0].version }, patch: { body: 'Updated comparison' } })
  const details = await run('noteboard_history', { id: update.operationId })
  expect(details.files.some((f) => f.before.includes('Tradeoffs') && f.after.includes('Updated comparison'))).toBe(true)
  state = await run('noteboard_query', {})
  await run('noteboard_layout', { canvasName: 'Main', canvasVersion: state.canvasVersion, ids, action: 'top' })
  await run('noteboard_restore', { id: update.operationId })
  expect((await run('noteboard_query', { ids: [id] })).notes[0].body).toBe('Tradeoffs')
})
it('rejects missing workspace, missing versions and unknown layout actions', async () => {
  await expect(tools.get('noteboard_query').execute({}, {})).rejects.toThrow('工作区')
  await expect(run('noteboard_update', { ids: ['a'], patch: {} })).rejects.toThrow('version')
  await expect(api.layout(root, { action: 'invented' })).rejects.toThrow('未知布局')
})
it('colors release notes by feature and lays them out in the requested version order', async () => {
  const { notes } = await run('noteboard_create', { canvasName: 'Main', notes: [
    { title: 'v1.10.0', body: 'New feature', tags: ['feature'] },
    { title: 'v1.9.0', body: 'Bug fix', tags: ['fix'] },
    { title: 'v1.10.0-rc.2', body: 'Feature preview', tags: ['preview'] },
  ] })
  const initial = await run('noteboard_query', { canvasName: 'Main' })
  const versions = Object.fromEntries(initial.notes.map((n) => [n.id, n.version]))
  await run('noteboard_update', { ids: [notes[0].id, notes[2].id], versions, patch: { color: 'blue' } })
  await run('noteboard_update', { ids: [notes[1].id], versions, patch: { color: 'green' } })
  const before = await run('noteboard_query', { canvasName: 'Main' })
  expect(before.notes.find((n) => n.id === notes[1].id).color).toBe('green')
  expect(before.notes.filter((n) => n.color === 'blue')).toHaveLength(2)
  const ids = [notes[1].id, notes[2].id, notes[0].id]
  await run('noteboard_layout', { canvasName: 'Main', canvasVersion: before.canvasVersion, ids, action: 'ordered', columns: 2 })
  const after = await run('noteboard_query', { canvasName: 'Main' })
  const nodes = [...after.canvas.nodes].sort((a, b) => a.y - b.y || a.x - b.x)
  expect(nodes.map((n) => n.id)).toEqual(ids)
  expect(nodes.map((n) => n.color)).toEqual(['4', '5', '5'])
  expect(after.notes).toEqual(before.notes)
})
