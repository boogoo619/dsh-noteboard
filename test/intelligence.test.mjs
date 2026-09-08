import { beforeEach, afterEach, it, expect } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApi } from '../src/commands.mjs'
import { registerIntelligence } from '../src/intelligence.mjs'
let root, tools, skills, api
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'nb-tools-')); api = buildApi(); tools = new Map(); skills = new Map()
  registerIntelligence({ inject(names, use) { use({ effect: (run) => run(), tools: { register: (tool) => tools.set(tool.name, tool) }, skills: { register: (skill) => skills.set(skill.name, skill) } }) } }, api)
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
const run = (name, args) => tools.get(name).execute(args, { agent: { session: { header: { cwd: root } } } })
it('registers four model/user workflows and ten tools', () => {
  expect(tools.size).toBe(10); expect(skills.size).toBe(4)
  for (const skill of skills.values()) expect(skill.invocation).toEqual({ modelInvocable: true, userInvocable: true })
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
