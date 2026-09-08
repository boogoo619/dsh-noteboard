import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  scaffold, readMeta, listCanvases, readCanvas, writeCanvas, listNotes,
  createNote, writeNote, parseFrontmatter, renderFrontmatter, noteFilename,
  backupCanvas, restoreBackup, hasBackup, deleteCanvas, findFreeSpot,
  COLOR_TO_CANVAS, NOTE_COLORS,
} from '../src/store.mjs'

let root

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'nb-test-'))
  await scaffold(root)
})
afterAll(async () => { await rm(root, { recursive: true, force: true }) })

describe('scaffold', () => {
  it('creates meta.json + Main.canvas on first use', async () => {
    expect((await listCanvases(root))).toContain('Main')
    expect((await readMeta(root)).activeCanvas).toBe('Main')
    expect(JSON.parse(await readFile(join(root, '.noteboard/canvases/Main.canvas'), 'utf8'))).toEqual({ nodes: [], edges: [], groups: [] })
  })
  it('is idempotent', async () => {
    await scaffold(root)
    expect((await listCanvases(root))).toEqual(['Main'])
  })
})

describe('frontmatter', () => {
  it('round-trips canonical fields + nested source', () => {
    const text = [
      '---',
      'type: note',
      'id: a3f2',
      'title: 推广思路',
      'color: blue',
      'tags: [灵感, 增长]',
      'created: 2026-02-14T10:30:00+08:00',
      'source:',
      '  sessionId: sess-xxxx',
      '  seq: 12',
      '  label: " IdeaGarage / 会话标题 · 2026-02-14 10:30"',
      '---',
      '',
      '正文',
    ].join('\n')
    const { data, extra, body } = parseFrontmatter(text)
    expect(data.id).toBe('a3f2')
    expect(data.tags).toEqual(['灵感', '增长'])
    expect(data.source).toEqual({ sessionId: 'sess-xxxx', seq: '12', label: ' IdeaGarage / 会话标题 · 2026-02-14 10:30' })
    expect(extra).toEqual({})
    expect(body.trim()).toBe('正文')
    const out = renderFrontmatter(data, extra, body)
    const back = parseFrontmatter(out)
    expect(back.data.id).toBe('a3f2')
    expect(back.data.tags).toEqual(['灵感', '增长'])
    expect(back.data.source.label).toContain('会话标题')
  })
  it('preserves unknown keys verbatim', () => {
    const text = '---\ntype: note\nid: ff01\ntitle: t\ncustom-thing: keep-me\n---\nbody'
    const { data, extra } = parseFrontmatter(text)
    expect(data.id).toBe('ff01')
    expect(extra['custom-thing']).toBe('keep-me')
    const out = renderFrontmatter(data, extra, 'body2')
    expect(out).toContain('custom-thing: keep-me')
    expect(parseFrontmatter(out).extra['custom-thing']).toBe('keep-me')
  })
  it('applies defaults on read', async () => {
    const note = await createNote(root, { title: '默认值' })
    const notes = await listNotes(root)
    const read = notes.find((n) => n.id === note.id)
    expect(read.color).toBe('yellow')
    expect(read.tags).toEqual([])
  })
})

describe('notes', () => {
  it('creates unique short ids and spec filenames', async () => {
    const a = await createNote(root, { title: '推广思路' })
    const b = await createNote(root, { title: '推广思路' })
    expect(a.id).not.toBe(b.id)
    expect(a.id).toMatch(/^[0-9a-f]{4}$/)
    expect(a.file).toBe(`${a.created.slice(0, 10)}-${'推广思路'}-${a.id}.md`)
    expect(noteFilename('2026-02-14T10:30:00+08:00', '推广思路', 'a3f2')).toBe('2026-02-14-推广思路-a3f2.md')
  })
  it('writeNote persists edits', async () => {
    const n = await createNote(root, { title: 't1' })
    n.title = 't2'
    n.tags = ['x']
    await writeNote(root, n)
    const read = (await listNotes(root)).find((x) => x.id === n.id)
    expect(read.title).toBe('t2')
    expect(read.tags).toEqual(['x'])
  })
})

describe('canvases', () => {
  it('write/read round-trip and guards last canvas', async () => {
    await writeCanvas(root, 'Main', { nodes: [{ id: 'x', type: 'text', x: 1, y: 2, width: 3, height: 4 }], edges: [], groups: [] })
    expect((await readCanvas(root, 'Main')).nodes).toHaveLength(1)
    await expect(deleteCanvas(root, 'Main')).rejects.toThrow(/至少保留一个画布/)
  })
  it('backup → restore clears the backup', async () => {
    await writeCanvas(root, 'Main', { nodes: [{ id: 'a' }], edges: [], groups: [] })
    await backupCanvas(root, 'Main')
    expect(await hasBackup(root, 'Main')).toBe(true)
    await writeCanvas(root, 'Main', { nodes: [{ id: 'b' }], edges: [], groups: [] })
    await restoreBackup(root, 'Main')
    expect((await readCanvas(root, 'Main')).nodes[0].id).toBe('a')
    expect(await hasBackup(root, 'Main')).toBe(false)
  })
  it('deleteCanvas repoints activeCanvas', async () => {
    await writeCanvas(root, 'Second', { nodes: [], edges: [], groups: [] })
    await deleteCanvas(root, 'Main')
    expect((await readMeta(root)).activeCanvas).toBe('Second')
    await writeCanvas(root, 'Main', { nodes: [], edges: [], groups: [] })
    await deleteCanvas(root, 'Second') // cleanup
    expect((await readMeta(root)).activeCanvas).toBe('Main')
  })
})

describe('findFreeSpot', () => {
  it('returns center when free', () => {
    expect(findFreeSpot([], 0, 0)).toEqual({ x: 0, y: 0 })
  })
  it('spirals out of an occupied center', () => {
    const occupied = [{ x: -300, y: -300, width: 600, height: 600 }]
    const p = findFreeSpot(occupied, 0, 0)
    expect(p.x * p.x + p.y * p.y).toBeGreaterThan(600 ** 2 / 4)
  })
})

describe('color map', () => {
  it('maps every named color; gray has no canvas color', () => {
    for (const c of NOTE_COLORS) expect(c in COLOR_TO_CANVAS).toBe(true)
    expect(COLOR_TO_CANVAS.gray).toBeNull()
    expect(Object.values(COLOR_TO_CANVAS).filter(Boolean).every((v) => ['1', '2', '3', '4', '5', '6'].includes(v))).toBe(true)
  })
})
