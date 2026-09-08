import * as store from './store.mjs'
import { serialized, transaction, history, restoreOperation, revision } from './persistence.mjs'
import { rearrangeNodes, orderedNodes } from './layout.mjs'
import { distill, distillWithRoute, listLlmOptions, resolveModel } from './distill.mjs'
import { resolvePreferences } from './preferences.mjs'
import { randomUUID } from 'node:crypto'
import { validateSource } from './sources.mjs'
import { nodeKind, nodeText, headingTag, normalizeNode, detachHeading, suppressHeading, applyManualNodes } from './nodes.mjs'

const hashCanvas = (c) => revision(JSON.stringify(c))
const tags = (values) => [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].slice(0, 30)
const checkVersion = (actual, expected) => { if (expected && actual !== expected) throw new Error('内容已被修改，请重新读取后重试') }
const labels = { updateNotes: '修改便签', createNotes: '创建便签', createText: '创建文本', updateText: '修改文本', duplicateText: '复制文本', removeNodes: '移除画布对象', layout: '整理布局', removeNotes: '从画布移除', addNotes: '放回画布', writeCanvas: '移动画布对象', saveAsNew: '另存为新画布', deleteCanvas: '删除画布', restoreOperation: '恢复操作' }

export function buildApi() {
  const api = { llm: null, settingsHandle: null }
  const preferences = () => resolvePreferences(api.settingsHandle?.get())
  async function state(root) {
    await store.scaffold(root)
    const meta = await store.readMeta(root), canvases = await store.listCanvases(root)
    if (!canvases.includes(meta.activeCanvas)) { meta.activeCanvas = canvases[0]; await store.writeMeta(root, meta) }
    const canvas = await store.readCanvas(root, meta.activeCanvas)
    const backups = Object.fromEntries(await Promise.all(canvases.map(async (n) => [n, await store.hasBackup(root, n)])))
    return { meta, canvases, notes: await store.listNotes(root), canvas, canvasVersion: hashCanvas(canvas), backups }
  }
  async function target(root, args = {}) {
    const name = args.canvasName ?? args.name ?? (await store.readMeta(root)).activeCanvas
    const canvas = await store.readCanvas(root, name)
    checkVersion(hashCanvas(canvas), args.canvasVersion)
    return { name, canvas }
  }
  async function selected(root, args) {
    const all = await store.listNotes(root)
    const ids = args.ids ?? (args.noteId ? [args.noteId] : args.file ? all.filter((n) => n.file === args.file).map((n) => n.id) : [])
    if (!Array.isArray(ids) || !ids.length) throw new Error('请指定便签 ID')
    return [...new Set(ids)].map((id) => {
      const note = all.find((n) => n.id === id)
      if (!note) throw new Error(`便签不存在：${id}`)
      checkVersion(note.version, args.versions?.[id] ?? args.version)
      return note
    })
  }
  async function textTarget(root, args) {
    if (!args.canvasName || typeof args.canvasVersion !== 'string') throw new Error('请指定画布和画布版本')
    return target(root, args)
  }
  function textNode(canvas, id) {
    const node = canvas.nodes.find((n) => n.id === id)
    if (!node || !['text', 'heading'].includes(nodeKind(node))) throw new Error('文本不存在')
    return node
  }
  function textPatch(node, patch) {
    const next = normalizeNode(node)
    if (patch.text !== undefined) {
      if (typeof patch.text !== 'string' || patch.text.length > 32000) throw new Error('文本最多 32,000 字符')
      next.text = patch.text
    }
    if (patch.fontSize !== undefined) {
      if (![14, 20, 28].includes(patch.fontSize)) throw new Error('文字字号无效')
      next.noteboard.fontSize = patch.fontSize
    }
    if (patch.color !== undefined) {
      if (!store.NOTE_COLORS.includes(patch.color)) throw new Error('文字颜色无效')
      next.noteboard.color = patch.color
    }
    if (patch.height !== undefined) {
      if (!Number.isFinite(patch.height) || patch.height <= 0 || patch.height > 100000) throw new Error('文本高度无效')
      next.height = patch.height
    }
    return next
  }
  async function saveNodes(root, name, canvas, extra = {}) {
    await store.writeCanvas(root, name, canvas); await store.clearBackup(root, name)
    return { ok: true, canvasVersion: hashCanvas(canvas), ...extra }
  }
  async function syncColors(root, notes) {
    for (const name of await store.listCanvases(root)) {
      const canvas = await store.readCanvas(root, name)
      let changed = false
      for (const node of canvas.nodes) {
        const note = notes.find((n) => n.id === node.id)
        if (!note) continue
        const color = store.COLOR_TO_CANVAS[note.color] ?? undefined
        if (node.color !== color) { node.color = color; changed = true }
      }
      if (changed) await store.writeCanvas(root, name, canvas)
    }
  }
  const methods = {
    state,
    async query(root, args) {
      const s = await state(root)
      const name = args.canvasName ?? s.meta.activeCanvas
      const c = await store.readCanvas(root, name)
      const query = String(args.query ?? '').toLocaleLowerCase()
      const notes = s.notes.filter((n) => (!args.ids || args.ids.includes(n.id)) && `${n.title}\n${n.body}\n${n.tags.join(' ')}`.toLocaleLowerCase().includes(query))
      return { ...s, canvas: c, canvasVersion: hashCanvas(c), notes: notes.map((n) => ({ ...n, onBoard: c.nodes.some((x) => x.id === n.id) })) }
    },
    async history(root, args) {
      const entries = await history(root)
      return args.id ? entries.find((e) => e.id === args.id) : entries.map(({ files, root: _, journal, ...entry }) => ({ ...entry, changedFiles: files.length }))
    },
    async restoreOperation(root, args) { return restoreOperation(root, args.id) },
    async switchCanvas(root, { name }) {
      if (!(await store.listCanvases(root)).includes(name)) throw new Error(`画布不存在：${name}`)
      await store.writeMeta(root, { ...await store.readMeta(root), activeCanvas: name }); return { ok: true }
    },
    async saveAsNew(root, args) {
      const s = await state(root), names = s.canvases
      let name = String(args.name ?? '').trim(), i = 2
      if (!name) { name = `${s.meta.activeCanvas}-副本`; while (names.includes(name)) name = `${s.meta.activeCanvas}-副本-${i++}` }
      if (names.includes(name)) throw new Error(`画布已存在：${name}`)
      const canvas = args.canvasName ? await store.readCanvas(root, args.canvasName) : s.canvas
      await store.writeCanvas(root, name, canvas)
      await store.writeMeta(root, { ...s.meta, activeCanvas: name }); return { ok: true, name }
    },
    async deleteCanvas(root, { name }) { await store.deleteCanvas(root, name); return { ok: true } },
    async writeCanvas(root, args) {
      if (!args.canvasName && args.name !== (await store.readMeta(root)).activeCanvas) throw new Error('只允许写激活画布')
      const { name, canvas } = await target(root, args)
      if (!args.canvasName && name !== (await store.readMeta(root)).activeCanvas) throw new Error('只允许写激活画布')
      const nodes = args.canvas?.nodes
      if (!Array.isArray(nodes) || new Set(nodes.map((n) => n.id)).size !== nodes.length || nodes.some((n) => !n.id || ![n.x, n.y, n.width, n.height].every(Number.isFinite) || n.width <= 0 || n.height <= 0)) throw new Error('布局坐标无效')
      canvas.nodes = applyManualNodes(canvas, nodes)
      return saveNodes(root, name, canvas)
    },
    async createText(root, args) {
      const { name, canvas } = await textTarget(root, args)
      if (![args.x, args.y].every(Number.isFinite)) throw new Error('文本坐标无效')
      const node = textPatch({ id: `text:${randomUUID()}`, type: 'text', text: '', x: args.x, y: args.y, width: 260, height: 30, noteboard: { kind: 'text', fontSize: 20 } }, args)
      if (!node.text.trim()) return { ok: true, canvasVersion: hashCanvas(canvas) }
      canvas.nodes.push(node)
      return saveNodes(root, name, canvas, { node })
    },
    async updateText(root, args) {
      const { name, canvas } = await textTarget(root, args)
      const old = textNode(canvas, args.id), patched = textPatch(old, args.patch ?? {})
      const changed = nodeText(old) !== patched.text || JSON.stringify(normalizeNode(old).noteboard) !== JSON.stringify(patched.noteboard)
      const node = changed ? detachHeading(canvas, patched) : patched
      if (!node.text.trim()) {
        if (nodeKind(old) === 'heading') suppressHeading(canvas, old)
        canvas.nodes = canvas.nodes.filter((n) => n.id !== old.id)
      } else canvas.nodes = canvas.nodes.map((n) => n.id === old.id ? node : n)
      return saveNodes(root, name, canvas, { node: node.text.trim() ? node : null })
    },
    async duplicateText(root, args) {
      const { name, canvas } = await textTarget(root, args), old = normalizeNode(textNode(canvas, args.id))
      const node = { ...old, id: `text:${randomUUID()}`, x: old.x + 24, y: old.y + 24, noteboard: { ...old.noteboard, kind: 'text' } }
      delete node.noteboard.sourceTag
      canvas.nodes.push(node)
      return saveNodes(root, name, canvas, { node })
    },
    async removeNodes(root, args) {
      const { name, canvas } = await textTarget(root, args)
      if (!Array.isArray(args.ids) || !args.ids.length || args.ids.some((id) => !canvas.nodes.some((n) => n.id === id))) throw new Error('画布对象不存在')
      for (const node of canvas.nodes) if (args.ids.includes(node.id) && nodeKind(node) === 'heading') suppressHeading(canvas, node)
      canvas.nodes = canvas.nodes.filter((n) => !args.ids.includes(n.id))
      return saveNodes(root, name, canvas)
    },
    async createNotes(root, args) {
      const { name, canvas } = await target(root, args)
      const drafts = args.notes
      if (!Array.isArray(drafts) || !drafts.length || drafts.length > 200) throw new Error('每次创建 1–200 张便签')
      const prepared = drafts.map((draft) => {
        if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error('便签草稿必须是对象')
        const source = Object.hasOwn(draft, 'source') ? draft.source : args.source
        validateSource(source)
        return { ...draft, source, color: draft.color ?? preferences().defaultColor, title: String(draft.title || '未命名').slice(0, 120), body: String(draft.body ?? ''), tags: tags(draft.tags ?? []) }
      })
      const created = []
      for (const draft of prepared) {
        const note = await store.createNote(root, draft)
        const pos = Number.isFinite(draft.x) && Number.isFinite(draft.y) ? draft : store.findFreeSpot(canvas.nodes, args.center?.x ?? 0, args.center?.y ?? 0)
        canvas.nodes.push(store.noteNode(note, pos.x, pos.y)); created.push(note)
      }
      await store.writeCanvas(root, name, canvas); await store.clearBackup(root, name)
      return { ok: true, notes: created, note: created[0], canvasName: name, succeeded: created.map((n) => n.id), failed: [] }
    },
    async updateNotes(root, args) {
      const notes = await selected(root, args), patch = args.patch ?? args
      if (patch.color !== undefined && !store.NOTE_COLORS.includes(patch.color)) throw new Error('便签颜色无效')
      for (const note of notes) {
        if (typeof patch.title === 'string') note.title = patch.title.slice(0, 120)
        if (typeof patch.body === 'string') note.body = patch.body
        if (patch.color) note.color = patch.color
        if (Array.isArray(patch.tags)) note.tags = tags(patch.tags)
        if (Array.isArray(patch.addTags)) note.tags = tags([...note.tags, ...patch.addTags])
        if (Array.isArray(patch.removeTags)) note.tags = note.tags.filter((t) => !patch.removeTags.includes(t))
        await store.writeNote(root, note)
      }
      await syncColors(root, notes)
      return { ok: true, succeeded: notes.map((n) => n.id), failed: [] }
    },
    async removeNotes(root, args) {
      const notes = await selected(root, args), { name, canvas } = await target(root, args)
      const ids = notes.map((n) => n.id)
      canvas.nodes = canvas.nodes.filter((n) => !ids.includes(n.id))
      await store.writeCanvas(root, name, canvas); await store.clearBackup(root, name)
      return { ok: true, succeeded: ids, failed: [] }
    },
    async addNotes(root, args) {
      const notes = await selected(root, args), { name, canvas } = await target(root, args)
      for (const note of notes) if (!canvas.nodes.some((n) => n.id === note.id)) {
        const p = store.findFreeSpot(canvas.nodes, args.center?.x ?? 0, args.center?.y ?? 0)
        canvas.nodes.push(store.noteNode(note, p.x, p.y))
      }
      await store.writeCanvas(root, name, canvas); return { ok: true, succeeded: notes.map((n) => n.id), failed: [] }
    },
    async layout(root, args) {
      if (!['rearrange', 'ordered', 'left', 'right', 'top', 'bottom', 'centerX', 'centerY', 'distributeX', 'distributeY'].includes(args.action)) throw new Error('未知布局操作')
      const { name, canvas } = await target(root, args)
      if (args.action === 'ordered') {
        const ids = args.ids
        if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new Error('请指定不重复的便签 ID')
        const nodes = ids.map((id) => canvas.nodes.find((n) => n.id === id && nodeKind(n) === 'note'))
        if (nodes.some((n) => !n)) throw new Error('便签不在指定画布中')
        const retained = canvas.nodes.filter((n) => !ids.includes(n.id))
        const placed = new Map(orderedNodes(nodes, retained, args.columns).map((n) => [n.id, n]))
        canvas.nodes = canvas.nodes.map((n) => placed.get(n.id) ?? n)
        await store.clearBackup(root, name)
      } else if (args.action === 'rearrange') {
        const all = await store.listNotes(root), ids = args.ids ?? canvas.nodes.filter((n) => nodeKind(n) === 'note').map((n) => n.id)
        const notes = all.filter((n) => ids.includes(n.id) && canvas.nodes.some((x) => x.id === n.id))
        await store.backupCanvas(root, name)
        if (args.regenerateHeadings && args.ids) throw new Error('重新生成标题需要完整重排')
        if (args.regenerateHeadings) canvas.noteboard = { ...canvas.noteboard, suppressedTagHeadings: [] }
        const retained = canvas.nodes.filter((n) => nodeKind(n) === 'note' ? !ids.includes(n.id) : nodeKind(n) !== 'heading' || args.ids)
        const placed = rearrangeNodes(notes, { headings: !args.ids, suppressed: canvas.noteboard?.suppressedTagHeadings ?? [] })
        for (const node of placed) if (nodeKind(node) === 'heading') {
          const old = canvas.nodes.find((n) => nodeKind(n) === 'heading' && headingTag(n) === headingTag(node))
          if (old) node.id = old.id
          if (retained.some((n) => n.id === node.id)) node.id = `heading:${randomUUID()}`
        }
        if (retained.length) {
          const offset = Math.max(...retained.map((n) => n.x + n.width)) + 96
          for (const node of placed) node.x += offset
        }
        canvas.nodes = [...retained, ...placed]
      } else {
        const ids = args.ids ?? []
        if (!Array.isArray(ids) || ids.some((id) => !canvas.nodes.some((n) => n.id === id))) throw new Error('画布对象不存在')
        const noteIds = ids.filter((id) => canvas.nodes.some((n) => n.id === id && nodeKind(n) === 'note'))
        if (args.versions && noteIds.length) await selected(root, { ...args, ids: noteIds })
        const previous = { ...canvas, nodes: canvas.nodes.map((n) => ({ ...n })) }
        const nodes = canvas.nodes.filter((n) => ids.includes(n.id))
        if (nodes.length < (args.action?.startsWith('distribute') ? 3 : 2)) throw new Error('选择的便签数量不足')
        const left = Math.min(...nodes.map((n) => n.x)), right = Math.max(...nodes.map((n) => n.x + n.width))
        const top = Math.min(...nodes.map((n) => n.y)), bottom = Math.max(...nodes.map((n) => n.y + n.height))
        for (const n of nodes) {
          if (args.action === 'left') n.x = left
          else if (args.action === 'right') n.x = right - n.width
          else if (args.action === 'top') n.y = top
          else if (args.action === 'bottom') n.y = bottom - n.height
          else if (args.action === 'centerX') n.x = (left + right - n.width) / 2
          else if (args.action === 'centerY') n.y = (top + bottom - n.height) / 2
        }
        if (args.action === 'distributeX' || args.action === 'distributeY') {
          const key = args.action === 'distributeX' ? 'x' : 'y', size = key === 'x' ? 'width' : 'height'
          nodes.sort((a, b) => a[key] - b[key])
          const last = nodes.at(-1), gap = (last[key] + last[size] - nodes[0][key] - nodes.reduce((s, n) => s + n[size], 0)) / (nodes.length - 1)
          let position = nodes[0][key]
          for (const node of nodes) { node[key] = position; position += node[size] + gap }
        }
        canvas.nodes = applyManualNodes(previous, canvas.nodes)
        canvas.noteboard = previous.noteboard
      }
      await store.writeCanvas(root, name, canvas); return { ok: true, canvasVersion: hashCanvas(canvas) }
    },
    async restoreLayout(root, args) {
      const { name } = await target(root, args)
      if (!await store.restoreBackup(root, name)) throw new Error('没有可恢复的布局备份')
      return { ok: true }
    },
    async clearBackup(root, args) { await store.clearBackup(root, (await target(root, args)).name); return { ok: true } },
    async llmOptions() {
      const providers = await listLlmOptions(api.llm)
      try { return { providers, resolved: resolveModel(providers, preferences()) } }
      catch (e) { return { providers, resolved: null, error: e.message } }
    },
  }
  const reads = new Set(['state', 'query', 'history', 'llmOptions'])
  for (const [method, fn] of Object.entries(methods)) api[method] = (root, args = {}) => serialized(root, async () => {
    if (method !== 'llmOptions') await store.scaffold(root)
    if (reads.has(method) || method === 'switchCanvas') return fn(root, args)
    return transaction(root, labels[method] ?? method, () => fn(root, args), { historyLimit: preferences().historyLimit })
  })
  api.createNote = async (root, args = {}) => { const result = await api.createNotes(root, { ...args, notes: [args] }); return { ...result, path: `.noteboard/notes/${result.note.file}` } }
  api.updateNote = (root, args) => api.updateNotes(root, args)
  api.setNoteColor = api.updateNote
  api.addTag = (root, args) => api.updateNotes(root, { ...args, patch: { addTags: [args.tag] } })
  api.removeTag = (root, args) => api.updateNotes(root, { ...args, patch: { removeTags: [args.tag] } })
  api.removeFromCanvas = (root, args) => api.removeNotes(root, args)
  api.rearrange = (root, args) => api.layout(root, { ...args, action: 'rearrange' })
  api.distillNote = async (root, args) => {
    const s = await api.state(root)
    const canvasName = args.canvasName ?? s.meta.activeCanvas
    if (!api.llm) throw new Error('llm 服务不可用，无法提炼')
    const result = await distill(api.llm, String(args.text ?? ''), api.settingsHandle?.get() ?? {})
    return api.createNote(root, { ...result, canvasName, source: args.source, center: args.center })
  }
  api.distillPreview = async (_root, args = {}) => {
    const { note, provider, model } = await distillWithRoute(api.llm, args.text, preferences())
    return { ...note, provider, model }
  }
  return api
}
