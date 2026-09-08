/**
 * API-surface tests (src/index.mjs buildApi): every RPC method receives
 * `(root, argsObject)` — the dispatch endpoint passes ONE args object. These
 * tests pin that contract (the positional-arg form silently broke
 * switchCanvas/saveAsNew/deleteCanvas/writeCanvas/removeFromCanvas) plus the
 * spec §3.3 backup semantics (「恢复布局」按钮直到下一次改动).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildApi } from '../src/index.mjs'
import { listNotes, readCanvas, readMeta, writeMeta } from '../src/store.mjs'

let root
let api

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'nb-api-'))
  api = buildApi()
  api.llm = null // distill path untested here (needs a live provider)
  api.settingsHandle = { get: () => ({}) }
})
afterAll(async () => { await rm(root, { recursive: true, force: true }) })

describe('rpc arg shape: (root, argsObject)', () => {
  it('state scaffolds the workspace', async () => {
    const s = await api.state(root)
    expect(s.canvases).toEqual(['Main'])
    expect(s.meta.activeCanvas).toBe('Main')
    expect(s.notes).toEqual([])
  })

  it('createNote writes md + places a node', async () => {
    const { note } = await api.createNote(root, { title: '甲', body: 'A', tags: ['x'], color: 'blue', x: 10, y: 10 })
    expect(note.id).toMatch(/^[0-9a-f]{4}$/)
    const s = await api.state(root)
    expect(s.notes.map((n) => n.id)).toContain(note.id)
    expect(s.canvas.nodes.map((n) => n.id)).toEqual([note.id])
    expect(s.canvas.nodes[0].color).toBe('5') // blue → JSON Canvas "5"
  })

  it('writeCanvas accepts the active canvas and persists nodes', async () => {
    const s = await api.state(root)
    const id = s.canvas.nodes[0].id
    const r = await api.writeCanvas(root, { name: 'Main', canvas: { nodes: [{ id, type: 'text', x: 88, y: 64, width: 260, height: 180 }] } })
    expect(r.ok).toBe(true)
    expect((await readCanvas(root, 'Main')).nodes[0]).toMatchObject({ id, x: 88, y: 64 })
  })

  it('writeCanvas rejects a non-active canvas', async () => {
    await expect(api.writeCanvas(root, { name: 'Other', canvas: { nodes: [] } }))
      .rejects.toThrow('只允许写激活画布')
  })

  it('switchCanvas switches the meta pointer', async () => {
    await api.saveAsNew(root, { name: 'Second' }) // snapshot + activate Second
    expect((await readMeta(root)).activeCanvas).toBe('Second')
    await api.switchCanvas(root, { name: 'Main' })
    expect((await readMeta(root)).activeCanvas).toBe('Main')
  })

  it('switchCanvas rejects unknown names', async () => {
    await expect(api.switchCanvas(root, { name: 'Nope' })).rejects.toThrow('画布不存在')
  })

  it('state self-heals a stale activeCanvas pointer (external deletion)', async () => {
    const meta = await readMeta(root)
    const stale = { ...meta, activeCanvas: 'Gone' }
    await (await import('../src/store.mjs')).writeMeta(root, stale)
    const s = await api.state(root)
    expect(s.canvases.includes(s.meta.activeCanvas)).toBe(true)
    expect((await readMeta(root)).activeCanvas).not.toBe('Gone')
  })

  it('saveAsNew rejects names with spaces/· and says what is allowed', async () => {
    await expect(api.saveAsNew(root, { name: '带 空格' })).rejects.toThrow('画布名只能用中文、字母、数字')
    await expect(api.saveAsNew(root, { name: '复盘·0908' })).rejects.toThrow('画布名只能用中文、字母、数字')
    const ok = await api.saveAsNew(root, { name: '复盘-0908_v2' })
    expect(ok.name).toBe('复盘-0908_v2')
    await api.deleteCanvas(root, { name: '复盘-0908_v2' })
  })

  it('saveAsNew survives a stale activeCanvas pointer', async () => {
    await (await import('../src/store.mjs')).writeMeta(root, { ...(await readMeta(root)), activeCanvas: 'Gone' })
    const r = await api.saveAsNew(root, { name: 'FromStale' })
    expect(r.ok).toBe(true)
    expect((await readMeta(root)).activeCanvas).toBe('FromStale')
    await api.switchCanvas(root, { name: 'Main' })
    await api.deleteCanvas(root, { name: 'FromStale' })
  })

  it('saveAsNew snapshots layout without copying note files', async () => {
    const before = (await readdir(join(root, '.noteboard/notes'))).length
    const r = await api.saveAsNew(root, { name: 'Third' })
    expect(r.name).toBe('Third')
    expect((await readCanvas(root, 'Third')).nodes.length).toBeGreaterThan(0)
    expect((await readdir(join(root, '.noteboard/notes'))).length).toBe(before)
  })

  it('deleteCanvas removes the canvas and re-points meta; last one protected', async () => {
    await api.deleteCanvas(root, { name: 'Third' })
    const s = await api.state(root)
    expect(s.canvases).not.toContain('Third')
    // delete the active one too — meta must move to a survivor
    await api.deleteCanvas(root, { name: 'Second' })
    expect(s.canvases.includes((await readMeta(root)).activeCanvas)).toBe(true)
    // only Main left now
    await expect(api.deleteCanvas(root, { name: 'Main' })).rejects.toThrow('至少保留一个画布')
  })

  it('removeFromCanvas drops the node but keeps the md file', async () => {
    const s = await api.state(root)
    const id = s.canvas.nodes[0].id
    const filesBefore = (await readdir(join(root, '.noteboard/notes'))).length
    const r = await api.removeFromCanvas(root, { noteId: id })
    expect(r.ok).toBe(true)
    expect((await readCanvas(root, 'Main')).nodes).toEqual([])
    expect((await readdir(join(root, '.noteboard/notes'))).length).toBe(filesBefore)
  })
})

describe('rearrange + backup semantics (spec §3.3)', () => {
  it('rearrange clusters by tag and creates a backup', async () => {
    await api.createNote(root, { title: 'r1', body: 'x', tags: ['a'] })
    await api.createNote(root, { title: 'r2', body: 'x', tags: ['b', 'a'] }) // first tag b wins
    await api.createNote(root, { title: 'r3', body: 'x' }) // 未分类
    await api.rearrange(root)
    const canvas = await readCanvas(root, 'Main')
    const tags = canvas.nodes.filter((n) => String(n.id).startsWith('tag:')).map((n) => n.text)
    expect([...new Set(tags)].sort()).toEqual(['a', 'b', '未分类'].sort())
    expect(tags[tags.length - 1]).toBe('未分类') // untagged cluster rightmost
    expect(existsSync(join(root, '.noteboard/canvases/Main.backup.json'))).toBe(true)
  })

  it('restoreLayout brings the pre-rearrange layout back', async () => {
    await api.restoreLayout(root)
    const canvas = await readCanvas(root, 'Main')
    expect(canvas.nodes.some((n) => String(n.id).startsWith('tag:'))).toBe(false)
    expect(existsSync(join(root, '.noteboard/canvases/Main.backup.json'))).toBe(false)
  })

  it('any later layout change retires the backup（直到下一次改动）', async () => {
    await api.rearrange(root)
    expect(existsSync(join(root, '.noteboard/canvases/Main.backup.json'))).toBe(true)
    // a drag write (the client's debounced save path) retires it
    const canvas = await readCanvas(root, 'Main')
    await api.writeCanvas(root, { name: 'Main', canvas })
    expect(existsSync(join(root, '.noteboard/canvases/Main.backup.json'))).toBe(false)
    // rearrange again, then a new note retires it too
    await api.rearrange(root)
    await api.createNote(root, { title: 'late', body: 'x', x: 0, y: 0 })
    expect(existsSync(join(root, '.noteboard/canvases/Main.backup.json'))).toBe(false)
  })
})

describe('note edits round-trip', () => {
  it('updateNote syncs md + canvas palette', async () => {
    const notes = await listNotes(root)
    const note = notes[0]
    await api.updateNote(root, { file: note.file, title: '新标题', body: '新正文', tags: ['t1', 't2'], color: 'pink' })
    const after = (await listNotes(root)).find((n) => n.id === note.id)
    expect(after.title).toBe('新标题')
    expect(after.tags).toEqual(['t1', 't2'])
    expect(after.color).toBe('pink')
    const node = (await readCanvas(root, 'Main')).nodes.find((n) => n.id === note.id)
    expect(node.color).toBe('1') // pink → "1"
    const raw = await readFile(join(root, '.noteboard/notes', note.file), 'utf8')
    expect(raw).toContain('title: 新标题')
    expect(raw).toContain('color: pink')
  })

  it('addTag/removeTag edit the frontmatter', async () => {
    const note = (await listNotes(root))[0]
    await api.addTag(root, { file: note.file, tag: '加签' })
    expect((await listNotes(root))[0].tags).toContain('加签')
    await api.removeTag(root, { file: note.file, tag: '加签' })
    expect((await listNotes(root))[0].tags).not.toContain('加签')
  })

  it('source round-trips through frontmatter (回链恒存 label)', async () => {
    const { note } = await api.createNote(root, {
      title: '回链', body: 's',
      source: { sessionId: 'sess-abc', seq: 3, label: 'IdeaGarage / 会话 · 2026-09-07' },
    })
    const back = (await listNotes(root)).find((n) => n.id === note.id)
    expect(back.source).toMatchObject({ sessionId: 'sess-abc', label: 'IdeaGarage / 会话 · 2026-09-07' })
  })
})

describe('distill settings consumption (设置面板 → 提炼路径)', () => {
  it('uses the configured provider/model/prompt from the settings handle', async () => {
    const calls = []
    const fakeLlm = {
      listProviders: () => [{ id: 'p1' }, { id: 'p2' }],
      listModels: async (p) => (p === 'p1' ? [{ id: 'm1' }] : [{ id: 'm2' }]),
      stream(req) {
        calls.push(req)
        return (async function* () { yield { type: 'text-delta', text: '{"title":"配置生效","tags":["验证"],"body":"B"}' } })()
      },
    }
    const prevLlm = api.llm
    const prevHandle = api.settingsHandle
    api.llm = fakeLlm
    api.settingsHandle = { get: () => ({ provider: 'p2', model: 'm2', prompt: '自定义提示词：只输出 JSON' }) }
    try {
      const { note } = await api.distillNote(root, { text: '内容' })
      expect(note.title).toBe('配置生效')
      expect(calls[0]).toMatchObject({ provider: 'p2', model: 'm2' })
      expect(calls[0].messages[0].content[0].text).toContain('自定义提示词：只输出 JSON')
    } finally {
      api.llm = prevLlm
      api.settingsHandle = prevHandle
    }
  })

  it('falls back to the first provider/model when settings are empty', async () => {
    const calls = []
    const fakeLlm = {
      listProviders: () => [{ id: 'p1' }, { id: 'p2' }],
      listModels: async (p) => (p === 'p1' ? [{ id: 'm1' }] : [{ id: 'm2' }]),
      stream(req) {
        calls.push(req)
        return (async function* () { yield { type: 'text-delta', text: '{"title":"默认路由","tags":[],"body":""}' } })()
      },
    }
    const prevLlm = api.llm
    const prevHandle = api.settingsHandle
    api.llm = fakeLlm
    api.settingsHandle = { get: () => ({}) }
    try {
      await api.distillNote(root, { text: '内容' })
      expect(calls[0]).toMatchObject({ provider: 'p1', model: 'm1' })
    } finally {
      api.llm = prevLlm
      api.settingsHandle = prevHandle
    }
  })
})
