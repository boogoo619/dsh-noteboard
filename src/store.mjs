import { mkdir, readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { randomBytes } from 'node:crypto'
import { parseDocument, Document } from 'yaml'
import { atomicWrite, atomicRemove, revision } from './persistence.mjs'

export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'orange', 'purple', 'gray']
export const COLOR_TO_CANVAS = { pink: '1', orange: '2', yellow: '3', green: '4', blue: '5', purple: '6', gray: null }
export const CARD_W = 260
export const CARD_H = 180
export class NoteboardError extends Error {
  constructor(code, message) { super(message); this.code = code }
}
export const nbRoot = (root) => join(root, '.noteboard')
export const canvasesDir = (root) => join(nbRoot(root), 'canvases')
export const notesDir = (root) => join(nbRoot(root), 'notes')
export const metaPath = (root) => join(nbRoot(root), 'meta.json')
export function canvasPath(root, name) {
  if (typeof name !== 'string' || !/^[\w\u4e00-\u9fff-]+$/.test(name)) throw new NoteboardError('bad-name', '画布名只能用中文、字母、数字、-、_（不含空格）')
  return join(canvasesDir(root), `${name}.canvas`)
}
const jsonWrite = (path, value) => atomicWrite(path, JSON.stringify(value, null, 2) + '\n')
export async function scaffold(root) {
  await mkdir(canvasesDir(root), { recursive: true }); await mkdir(notesDir(root), { recursive: true })
  if (!(await listCanvases(root)).length) await writeCanvas(root, 'Main', { nodes: [], edges: [], groups: [] })
  if (!existsSync(metaPath(root))) await writeMeta(root, { activeCanvas: (await listCanvases(root))[0] })
}
export async function readMeta(root) { return JSON.parse(await readFile(metaPath(root), 'utf8')) }
export const writeMeta = (root, meta) => jsonWrite(metaPath(root), meta)
export async function listCanvases(root) { return (await readdir(canvasesDir(root))).filter((f) => f.endsWith('.canvas')).map((f) => f.slice(0, -7)).sort() }
export async function readCanvas(root, name) {
  const c = JSON.parse(await readFile(canvasPath(root, name), 'utf8'))
  return { ...c, nodes: Array.isArray(c.nodes) ? c.nodes : [], edges: c.edges ?? [], groups: c.groups ?? [] }
}
export const writeCanvas = (root, name, canvas) => jsonWrite(canvasPath(root, name), canvas)
const backupPath = (root, name) => canvasPath(root, name).replace(/\.canvas$/, '.backup.json')
export async function backupCanvas(root, name) { await atomicWrite(backupPath(root, name), await readFile(canvasPath(root, name), 'utf8')) }
export async function hasBackup(root, name) { return existsSync(backupPath(root, name)) }
export async function clearBackup(root, name) { await atomicRemove(backupPath(root, name)) }
export async function restoreBackup(root, name) {
  if (!await hasBackup(root, name)) return false
  const raw = await readFile(backupPath(root, name), 'utf8'); JSON.parse(raw)
  await atomicWrite(canvasPath(root, name), raw); await clearBackup(root, name); return true
}
export async function deleteCanvas(root, name) {
  const names = await listCanvases(root)
  if (!names.includes(name)) throw new Error('画布不存在')
  if (names.length <= 1) throw new Error('至少保留一个画布')
  await atomicRemove(canvasPath(root, name)); await clearBackup(root, name)
  const meta = await readMeta(root)
  if (meta.activeCanvas === name) await writeMeta(root, { ...meta, activeCanvas: names.find((n) => n !== name) })
}
const canonical = ['type', 'id', 'title', 'color', 'tags', 'created', 'source', 'derivedFrom']
export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: null, extra: {}, body: text }
  const doc = parseDocument(match[1])
  if (doc.errors.length) throw new Error(`便签 YAML 无效：${doc.errors[0].message}`)
  const data = doc.toJS({ maxAliasCount: 100 })
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('便签元数据应为对象')
  if (data.source === 'null') data.source = null
  if (data.source?.seq != null) data.source.seq = String(data.source.seq)
  if (doc.has('id')) data.id = String(doc.get('id', true)?.source ?? data.id)
  return { data, extra: Object.fromEntries(Object.entries(data).filter(([k]) => !canonical.includes(k))), body: match[2] }
}
export function renderFrontmatter(data, extra = {}, body = '', original) {
  const doc = original ? parseDocument(original) : new Document()
  const values = { type: 'note', color: 'yellow', tags: [], ...extra, ...data }
  for (const [key, value] of Object.entries(values)) if (value !== undefined) doc.set(key, value)
  return `---\n${doc.toString({ lineWidth: 0 })}---\n${body}`
}
export function slugify(title) { return String(title || '未命名').trim().replace(/[\s/\\:!*?"<>|]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || '未命名' }
export const newId = () => randomBytes(2).toString('hex')
export const noteFilename = (date, title, id) => `${date.slice(0, 10)}-${slugify(title)}-${id}.md`
export async function listNoteFiles(root) { return (await readdir(notesDir(root))).filter((f) => f.endsWith('.md')).sort() }
export async function listNotes(root) {
  const notes = []
  for (const file of await listNoteFiles(root)) {
    const raw = await readFile(join(notesDir(root), file), 'utf8')
    const { data, extra, body } = parseFrontmatter(raw)
    if (!data || (data.type && data.type !== 'note') || !data.id) continue
    notes.push({ file, path: `.noteboard/notes/${file}`, id: String(data.id), title: String(data.title ?? ''),
      color: NOTE_COLORS.includes(data.color) ? data.color : 'yellow', tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      created: data.created ?? '', source: data.source && typeof data.source === 'object' ? data.source : null,
      derivedFrom: Array.isArray(data.derivedFrom) ? data.derivedFrom : [], body, extra, version: revision(raw) })
  }
  return notes
}
function notePath(root, file) {
  if (typeof file !== 'string' || basename(file) !== file || !file.endsWith('.md')) throw new Error('便签路径无效')
  return join(notesDir(root), file)
}
export const readNote = (root, file) => readFile(notePath(root, file), 'utf8')
export async function writeNote(root, note) {
  const path = notePath(root, note.file)
  let original
  try { original = (await readFile(path, 'utf8')).match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] } catch (e) { if (e.code !== 'ENOENT') throw e }
  const data = Object.fromEntries(canonical.map((k) => [k, k === 'type' ? 'note' : note[k]]))
  await atomicWrite(path, renderFrontmatter(data, note.extra, note.body ?? '', original))
}
export async function createNote(root, { title, body = '', tags = [], color = 'yellow', source = null, derivedFrom = [] }) {
  const existing = new Set((await listNotes(root)).map((n) => n.id))
  let id = newId(); while (existing.has(id)) id = newId()
  const created = new Date().toISOString()
  const note = { file: noteFilename(created, title, id), id, title, body, tags, color: NOTE_COLORS.includes(color) ? color : 'yellow', source, derivedFrom, created, extra: {} }
  await writeNote(root, note); return note
}
export function noteNode(note, x, y) {
  return { id: note.id, type: 'text', text: `[[.noteboard/notes/${note.file.replace(/\.md$/, '')}]]`,
    x: Math.round(x), y: Math.round(y), width: CARD_W, height: CARD_H, color: COLOR_TO_CANVAS[note.color] ?? undefined, noteboard: { kind: 'note' } }
}
export function findFreeSpot(rects, x, y, w = CARD_W, h = CARD_H) {
  const free = (a, b) => !rects.some((r) => a < r.x + r.width && a + w > r.x && b < r.y + r.height && b + h > r.y)
  if (free(x, y)) return { x, y }
  for (let ring = 1; ring < 200; ring++) for (let i = 0; i < ring * 8; i++) {
    const angle = i / (ring * 8) * Math.PI * 2
    const a = Math.round(x + Math.cos(angle) * ring * 40), b = Math.round(y + Math.sin(angle) * ring * 40)
    if (free(a, b)) return { x: a, y: b }
  }
  return { x: Math.max(x, ...rects.map((r) => r.x + r.width)) + 24, y }
}
