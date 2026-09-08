import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, rm, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

const transactions = new AsyncLocalStorage()
const queues = new Map()
export const revision = (text) => createHash('sha256').update(text).digest('hex')
export async function contents(path) {
  try { return await readFile(path, 'utf8') } catch (e) { if (e.code === 'ENOENT') return null; throw e }
}
async function replace(path, text) {
  if (text === null) { await rm(path, { force: true }); return }
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try { await writeFile(temporary, text, 'utf8'); await rename(temporary, path) }
  finally { await rm(temporary, { force: true }) }
}
export async function atomicWrite(path, text) {
  const tx = transactions.getStore()
  let record
  const before = await contents(path)
  if (before === text) return
  if (tx) {
    const key = relative(tx.root, path)
    const prior = tx.files.find((f) => f.path === key)
    if (prior) { prior.after = text; prior.completed = false; record = prior }
    else { record = { path: key, before, after: text, applied: before, completed: false }; tx.files.push(record) }
    await replace(tx.journal, JSON.stringify(tx, null, 2))
  }
  await replace(path, text)
  if (record) { record.applied = text; record.completed = true; await replace(tx.journal, JSON.stringify(tx, null, 2)) }
}
export const atomicRemove = (path) => atomicWrite(path, null)
export function serialized(root, run) {
  const key = resolve(root)
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(run)
  queues.set(key, next)
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key) }).catch(() => {})
  return next
}
export async function history(root) {
  const dir = join(root, '.noteboard/history')
  await mkdir(dir, { recursive: true })
  const entries = []
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.json')) continue
    const record = JSON.parse(await readFile(join(dir, file), 'utf8'))
    entries.push(record)
  }
  return entries.sort((a, b) => b.created.localeCompare(a.created))
}
export async function transaction(root, label, run, { historyLimit = 50 } = {}) {
  const id = randomUUID()
  const tx = { id, root: resolve(root), journal: join(resolve(root), '.noteboard/history', `${id}.json`),
    label, created: new Date().toISOString(), status: 'pending', files: [] }
  try {
    const value = await transactions.run(tx, run)
    tx.status = 'complete'
    if (tx.files.length) await replace(tx.journal, JSON.stringify(tx, null, 2))
    const limit = [50, 100, 200].includes(historyLimit) ? historyLimit : 50
    for (const old of (await history(root)).filter((entry) => entry.status !== 'pending').slice(limit)) await rm(join(root, '.noteboard/history', `${old.id}.json`), { force: true })
    return { ...value, ...(tx.files.length ? { operationId: id } : {}), changedFiles: tx.files.length }
  } catch (e) {
    tx.status = 'failed'; tx.error = String(e.message)
    if (tx.files.length) await replace(tx.journal, JSON.stringify(tx, null, 2))
    e.operationId = tx.files.length ? id : undefined
    e.completedFiles = tx.files.filter((f) => f.completed).map((f) => f.path)
    throw e
  }
}
export async function restoreOperation(root, id) {
  const entry = (await history(root)).find((e) => e.id === id)
  if (!entry || entry.status === 'restored') throw new Error('操作不存在或已恢复')
  const changes = []
  for (const f of entry.files) {
    if (!f.path.startsWith('.noteboard/') || f.path.startsWith('.noteboard/history/') || f.path.includes('..')) throw new Error('操作路径无效')
    const path = join(root, f.path)
    const current = await contents(path)
    if (current !== f.after && current !== f.before && (!Object.hasOwn(f, 'applied') || current !== f.applied)) throw new Error(`恢复冲突：${f.path} 已再次修改`)
    if (current !== f.before) changes.push({ path, before: f.before })
  }
  for (const f of changes.reverse()) await atomicWrite(f.path, f.before)
  entry.status = 'restored'
  await replace(join(root, '.noteboard/history', `${id}.json`), JSON.stringify(entry, null, 2))
  return { ok: true, restored: changes.length }
}
