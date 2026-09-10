import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApi } from '../src/commands.mjs'
import { parseFrontmatter, writeCanvas, readCanvas } from '../src/store.mjs'
import { transaction, atomicWrite, restoreOperation, history } from '../src/persistence.mjs'
import { canonicalWorkspaceRoot } from '../src/workspace-root.mjs'
let root, api
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'noteboard-v2-')); api = buildApi(); await api.state(root) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
describe('recoverable commands', () => {
  it('serializes concurrent creation without losing nodes or ids', async () => {
    const created = await Promise.all(Array.from({ length: 20 }, (_, i) => api.createNote(root, { title: `n${i}`, body: '正文' })))
    const s = await api.state(root)
    expect(new Set(s.canvas.nodes.map((n) => n.id)).size).toBe(20)
    expect(s.notes).toHaveLength(created.length)
  })
  it('rejects stale note versions before touching any selected file', async () => {
    await api.createNotes(root, { notes: [{ title: 'a' }, { title: 'b' }] })
    const { notes } = await api.state(root)
    const versions = Object.fromEntries(notes.map((n) => [n.id, n.version]))
    await api.updateNotes(root, { ids: [notes[1].id], versions, patch: { body: 'new' } })
    await expect(api.updateNotes(root, { ids: notes.map((n) => n.id), versions, patch: { title: 'changed' } })).rejects.toThrow('已被修改')
    expect((await api.state(root)).notes[0].title).toBe(notes[0].title)
  })
  it('restores note content and rejects restore across later edits', async () => {
    await api.createNote(root, { title: 'a', body: 'before' })
    const note = (await api.state(root)).notes[0]
    const edit = await api.updateNotes(root, { ids: [note.id], patch: { body: 'after' } })
    await api.restoreOperation(root, { id: edit.operationId })
    expect((await api.state(root)).notes[0].body).toBe('before')
    const next = await api.updateNotes(root, { ids: [note.id], patch: { body: 'second' } })
    await api.updateNotes(root, { ids: [note.id], patch: { body: 'third' } })
    await expect(api.restoreOperation(root, { id: next.operationId })).rejects.toThrow('恢复冲突')
  })
  it('keeps selection tasks on their original canvas after switching', async () => {
    await api.saveAsNew(root, { name: 'Other' })
    const made = await api.createNote(root, { canvasName: 'Main', title: 'origin' })
    expect((await api.state(root)).canvas.nodes).toHaveLength(0)
    expect((await readCanvas(root, 'Main')).nodes[0].id).toBe(made.note.id)
  })
  it('preserves external layout fields when rearranging and updating colors globally', async () => {
    const { note } = await api.createNote(root, { title: 'a' })
    const c = await readCanvas(root, 'Main')
    await writeCanvas(root, 'Main', { ...c, custom: { keep: true }, edges: [{ id: 'edge' }], groups: [{ id: 'group' }] })
    await api.saveAsNew(root, { name: 'Other' })
    await api.updateNotes(root, { ids: [note.id], patch: { color: 'pink' } })
    await api.rearrange(root, { canvasName: 'Main' })
    const after = await readCanvas(root, 'Main')
    expect(after).toMatchObject({ custom: { keep: true }, edges: [{ id: 'edge' }], groups: [{ id: 'group' }] })
    expect((await readCanvas(root, 'Other')).nodes[0].color).toBe('1')
  })
  it('round trips nested YAML, quoted punctuation, anchors and defaults', async () => {
    const path = join(root, '.noteboard/notes/custom.md')
    await writeFile(path, '---\nid: "0012"\ntitle: "A: B"\ntags: ["a,b", "c:d"]\ncustom:\n  nested: [true, 5, null]\nsource:\n  sessionId: session\n  fragments:\n    - key: user:12\n      text: "选中文本"\n      start: 5\n---\nbody')
    const note = (await api.state(root)).notes[0]
    expect(note.id).toBe('0012')
    await api.updateNotes(root, { ids: [note.id], patch: { title: 'quoted "title"' } })
    const parsed = parseFrontmatter(await readFile(path, 'utf8'))
    expect(parsed.extra.custom).toEqual({ nested: [true, 5, null] })
    expect(parsed.data.source.fragments[0]).toMatchObject({ text: '选中文本', start: 5 })
    expect(parsed.data.tags).toEqual(['a,b', 'c:d'])
  })
  it('records partial writes and can recover after a command fails', async () => {
    const path = join(root, '.noteboard/notes/partial.md')
    await expect(transaction(root, 'test', async () => { await atomicWrite(path, 'first'); throw new Error('injected write failure') })).rejects.toThrow('injected')
    const [entry] = await history(root)
    expect(entry.status).toBe('failed')
    await restoreOperation(root, entry.id)
    await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' })
  })
  it('recovers removed notes without deleting their files', async () => {
    const { note } = await api.createNote(root, { title: 'a' })
    const removal = await api.removeNotes(root, { ids: [note.id] })
    expect((await api.state(root)).notes).toHaveLength(1)
    expect((await api.state(root)).canvas.nodes).toHaveLength(0)
    await api.restoreOperation(root, { id: removal.operationId })
    expect((await api.state(root)).canvas.nodes).toHaveLength(1)
  })
  it('does not resurrect Main when a different canvas survives', async () => {
    await api.saveAsNew(root, { name: 'Other' }); await api.deleteCanvas(root, { name: 'Main' })
    expect((await api.state(root)).canvases).toEqual(['Other'])
  })
})

describe('journal keys', () => {
  it('records forward-slash workspace-relative keys on every platform', async () => {
    const created = await api.createNote(root, { title: '日记', body: '正文' })
    const journal = JSON.parse(await readFile(join(root, '.noteboard/history', `${created.operationId}.json`), 'utf8'))
    expect(journal.files.length).toBeGreaterThan(0)
    for (const file of journal.files) {
      expect(file.path).toMatch(/^\.noteboard\//)
      expect(file.path).not.toContain('\\')
    }
  })

  /**
   * The journal's workspace identity is the canonical root itself — the
   * canonical form is a fixed point of the queue key, so normalizing the drive
   * letter inside the realpath branch cannot rewrite what is already on disk in
   * `.noteboard/history/`. That is what makes this change migration-free.
   */
  it('stores the canonical root as the journal identity', async () => {
    const created = await api.createNote(root, { title: '身份', body: '正文' })
    const journal = JSON.parse(await readFile(join(root, '.noteboard/history', `${created.operationId}.json`), 'utf8'))
    expect(journal.root).toBe(await canonicalWorkspaceRoot(root))
  })
})
