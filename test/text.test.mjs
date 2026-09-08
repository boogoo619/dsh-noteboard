import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApi } from '../src/commands.mjs'
import { readCanvas, writeCanvas } from '../src/store.mjs'
import { nodeKind } from '../src/nodes.mjs'

let root, api
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'noteboard-text-')); api = buildApi(); await api.state(root) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
async function call(method, args = {}, canvasName = 'Main') {
  const s = await api.query(root, { canvasName })
  return api[method](root, { canvasName, canvasVersion: s.canvasVersion, ...args })
}
async function seed() {
  await api.createNotes(root, { notes: [{ title: 'one', tags: ['a'] }, { title: 'two', tags: ['b'] }] })
  await call('rearrange')
  return (await api.state(root)).canvas
}
describe('canvas text', () => {
  it('creates, edits, duplicates and removes text without note files', async () => {
    const { node } = await call('createText', { text: 'line 1\nline 2', x: 24, y: 40 })
    expect(node).toMatchObject({ type: 'text', width: 260, noteboard: { kind: 'text', fontSize: 20 } })
    await call('updateText', { id: node.id, patch: { text: 'changed', fontSize: 28, color: 'pink', height: 84 } })
    const { node: copy } = await call('duplicateText', { id: node.id })
    expect(copy).toMatchObject({ text: 'changed', x: 48, y: 64, height: 84, noteboard: { fontSize: 28, color: 'pink' } })
    expect(copy.id).not.toBe(node.id)
    await call('removeNodes', { ids: [node.id, copy.id] })
    expect((await api.state(root)).canvas.nodes).toEqual([])
    expect(await readdir(join(root, '.noteboard/notes'))).toEqual([])
  })
  it('does not create empty text and removes existing text saved empty', async () => {
    await call('createText', { text: '  \n', x: 0, y: 0 })
    expect((await api.state(root)).canvas.nodes).toEqual([])
    const { node } = await call('createText', { text: 'x', x: 0, y: 0 })
    await call('updateText', { id: node.id, patch: { text: '' } })
    expect((await api.state(root)).canvas.nodes).toEqual([])
  })
  it('rejects stale versions and invalid text before writing', async () => {
    const s = await api.state(root)
    const { node } = await call('createText', { text: 'x', x: 0, y: 0 })
    await expect(call('updateText', { id: node.id, patch: { text: 'stale' }, canvasVersion: s.canvasVersion })).rejects.toThrow('已被修改')
    await expect(call('updateText', { id: node.id, patch: { fontSize: 999 } })).rejects.toThrow('字号')
    expect((await api.state(root)).canvas.nodes[0].text).toBe('x')
  })
  it('supports mixed alignment and removal without deleting note content', async () => {
    const { note } = await api.createNote(root, { title: 'keep' })
    const { node } = await call('createText', { text: 'caption', x: 400, y: 400 })
    await call('layout', { action: 'left', ids: [note.id, node.id] })
    const nodes = (await api.state(root)).canvas.nodes
    expect(nodes[0].x).toBe(nodes[1].x)
    const result = await call('removeNodes', { ids: [note.id, node.id] })
    expect((await api.state(root)).notes).toHaveLength(1)
    await api.restoreOperation(root, { id: result.operationId })
    expect((await api.state(root)).canvas.nodes).toHaveLength(2)
  })
  it('preserves custom fields, text and suppression across save-as and history', async () => {
    await seed()
    const c = await readCanvas(root, 'Main')
    await writeCanvas(root, 'Main', { ...c, custom: 'keep', edges: [{ id: 'edge' }], groups: [{ id: 'group' }] })
    await call('removeNodes', { ids: ['tag:a'] })
    const { node } = await call('createText', { text: 'free', x: 800, y: 800 })
    await api.saveAsNew(root, { name: 'Other' })
    expect(await readCanvas(root, 'Other')).toMatchObject({ custom: 'keep', edges: [{ id: 'edge' }], groups: [{ id: 'group' }], noteboard: { suppressedTagHeadings: ['a'] } })
    await call('updateText', { id: node.id, patch: { text: 'only main' } })
    expect((await readCanvas(root, 'Other')).nodes.find((n) => n.id === node.id).text).toBe('free')
  })
})
describe('heading ownership and rearrange', () => {
  it('converts legacy headings on edit without renaming note tags', async () => {
    await seed()
    const c = await readCanvas(root, 'Main'), heading = c.nodes.find((n) => n.id === 'tag:a')
    delete heading.noteboard; heading.text = '# a'
    await writeCanvas(root, 'Main', c)
    await call('updateText', { id: heading.id, patch: { text: 'new title' } })
    await call('rearrange')
    const s = await api.state(root), edited = s.canvas.nodes.find((n) => n.id === heading.id)
    expect(edited).toMatchObject({ text: 'new title', x: heading.x, y: heading.y, noteboard: { kind: 'text' } })
    expect(s.canvas.noteboard.suppressedTagHeadings).toContain('a')
    expect(s.notes.some((n) => n.tags.includes('a'))).toBe(true)
  })
  it('manual moves detach headings while automatic reflow remains repeatable', async () => {
    const c = await seed()
    const changed = c.nodes.map((n) => n.id === 'tag:a' ? { ...n, x: n.x + 80 } : n)
    await call('writeCanvas', { canvas: { nodes: changed } })
    await call('rearrange')
    const first = (await api.state(root)).canvas
    await call('rearrange')
    expect((await api.state(root)).canvas).toEqual(first)
    expect(first.nodes.find((n) => n.id === 'tag:a').noteboard.kind).toBe('text')
  })
  it('deleted headings stay hidden and explicit regeneration avoids duplicate ids', async () => {
    await seed()
    await call('updateText', { id: 'tag:a', patch: { text: 'manual' } })
    await call('removeNodes', { ids: ['tag:b'] })
    await call('rearrange')
    expect((await api.state(root)).canvas.nodes.filter((n) => nodeKind(n) === 'heading')).toHaveLength(0)
    await call('rearrange', { regenerateHeadings: true })
    const first = (await api.state(root)).canvas
    expect(first.nodes.filter((n) => nodeKind(n) === 'heading')).toHaveLength(2)
    expect(first.nodes.some((n) => n.text === 'manual')).toBe(true)
    expect(new Set(first.nodes.map((n) => n.id)).size).toBe(first.nodes.length)
    await call('rearrange')
    expect((await api.state(root)).canvas).toEqual(first)
  })
  it('layout writes transfer styled headings to free text', async () => {
    const c = await seed()
    const nodes = c.nodes.map((n) => n.id === 'tag:a' ? { ...n, noteboard: { ...n.noteboard, color: 'pink' } } : n)
    await call('writeCanvas', { canvas: { nodes } })
    await call('rearrange')
    const next = (await api.state(root)).canvas
    expect(next.nodes.find((n) => n.id === 'tag:a').noteboard).toMatchObject({ kind: 'text', color: 'pink' })
    expect(next.noteboard.suppressedTagHeadings).toContain('a')
  })
  it('partial rearrange keeps every title and free text unchanged', async () => {
    await seed()
    await call('createText', { text: 'free', x: 100, y: 800 })
    const before = (await api.state(root)).canvas.nodes, note = before.find((n) => nodeKind(n) === 'note')
    await call('rearrange', { ids: [note.id] })
    const after = (await api.state(root)).canvas.nodes
    for (const node of before.filter((n) => n.id !== note.id)) expect(after.find((n) => n.id === node.id)).toEqual(node)
  })
  it('copying a heading leaves its original managed and copies plain text', async () => {
    await seed()
    const { node } = await call('duplicateText', { id: 'tag:a' })
    expect(node.noteboard.kind).toBe('text')
    expect(node.noteboard.sourceTag).toBeUndefined()
    const c = (await api.state(root)).canvas
    expect(c.nodes.find((n) => n.id === 'tag:a').noteboard.kind).toBe('heading')
    expect(c.noteboard?.suppressedTagHeadings ?? []).toEqual([])
  })
})
