import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, MoreHorizontal, Scan, Minus, RotateCcw, X, History, FilePlus2, Trash2, LayoutGrid, ArrowUpRight, StickyNote, RefreshCw } from 'lucide-react'
import { rpc } from '../api'
import { renderMarkdown } from '../markdown'
import { IconButton, Dialog } from '../ui'
import { CardMenu } from './CardMenu'
import { NoteEditor } from './NoteEditor'
import { NodeMenu } from './NodeMenu'
import { TextEditor, textHeight } from './TextEditor'
import { nodeKind, nodeText } from '../../nodes.mjs'
import { BoardTools, useDock } from '../composer'
import { flushLayout, queueLayout, pendingLayout } from './layoutWrites'
import { screenToBoard, zoomAt, marqueeHits, snap, fitCamera, RESET_CAM, CARD_W, CARD_H, type Camera, type NbState, type NbNode, type NbNote } from '../types'

type Gesture = { kind: 'pan' | 'select' | 'cards'; sx: number; sy: number; cam: Camera; moved: boolean; nodes: NbNode[]; ids: Set<string>; original: Set<string>; additive?: boolean; clicked?: string; toggle?: boolean }
const storedViews = new Map<string, { cam: Camera; selection: string[] }>()
const inputTarget = (target: any) => Boolean(target?.closest('input,textarea,select,[contenteditable=true],[role=dialog]'))
function NoteBody({ body }: { body: string }) {
  const element = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  useEffect(() => {
    const el = element.current!
    const measure = () => setOverflow(el.scrollHeight > el.clientHeight + 1)
    measure(); const observer = new ResizeObserver(measure); observer.observe(el)
    return () => observer.disconnect()
  }, [body])
  return <div ref={element} className={`nb-card-body${overflow ? ' nb-body-overflow' : ''}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}/>
}

export function CanvasView(props: any) {
  const session = props.useSessions ? props.useSessions((s: any) => s.byId?.[props.sessionId]) : props.sessions?.list?.getSnapshot()?.byId?.[props.sessionId]
  const cwd = session?.cwd ?? props.cwd
  const dock = useDock(props.composer, props.sessionId)
  const [data, setData] = useState<NbState | null>(null), [nodes, setNodes] = useState<NbNode[]>([])
  const [cam, setCam] = useState<Camera>({ ...RESET_CAM }), [selection, setSelection] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'select' | 'pan'>(dock.toolMode), [dragging, setDragging] = useState(false)
  const [placement, setPlacement] = useState(false), [textEditing, setTextEditing] = useState<NbNode | null>(null), [zoomMenu, setZoomMenu] = useState(false)
  const [insets, setInsets] = useState({ top: 76, right: 16, bottom: 76, left: 16 })
  const [marquee, setMarquee] = useState<any>(null), [error, setError] = useState(''), [status, setStatus] = useState('')
  const [menu, setMenu] = useState(false), [drawer, setDrawer] = useState(''), [query, setQuery] = useState(''), [offboard, setOffboard] = useState(false)
  const [editing, setEditing] = useState<any>(null), [source, setSource] = useState<NbNote | null>(null)
  const [tagFocus, setTagFocus] = useState(''), [saveAs, setSaveAs] = useState(false), [name, setName] = useState('')
  const [records, setRecords] = useState<any[]>([]), [record, setRecord] = useState<any>(null)
  const [pulse, setPulse] = useState(''), [size, setSize] = useState({ width: 800, height: 600 })
  const board = useRef<HTMLDivElement>(null), gesture = useRef<Gesture | null>(null), space = useRef(false), mounted = useRef(true)
  const rootElement = useRef<HTMLDivElement>(null), tools = useRef<any>(null), writes = useRef<Promise<any>>(Promise.resolve())
  const effectiveMode = dock.expanded && dock.available ? 'select' : mode
  const state = useRef({ cam, nodes, data, selection }); state.current = { cam, nodes, data, selection }
  const activeName = data?.meta.activeCanvas ?? 'Main'
  const liveRoot = useRef(cwd); liveRoot.current = cwd
  const cacheKey = `${cwd}\n${activeName}`
  const reload = useCallback(async () => {
    if (!cwd) return
    const result = await rpc(cwd, 'state') as NbState
    if (!mounted.current || liveRoot.current !== cwd) return
    state.current.data = result
    setData(result)
    if (!gesture.current) { const next = pendingLayout(cwd, result.meta.activeCanvas)?.args.canvas.nodes ?? result.canvas.nodes; state.current.nodes = next; setNodes(next) }
  }, [cwd])
  useEffect(() => { mounted.current = true; void reload().catch((e) => setError(e.message)); return () => { mounted.current = false } }, [reload])
  useEffect(() => {
    const saved = storedViews.get(cacheKey) ?? (() => { try { return JSON.parse(localStorage.getItem(`noteboard:view:${cacheKey}`) ?? 'null') } catch { return null } })()
    setCam(saved?.cam ?? { ...RESET_CAM }); setSelection(new Set(saved?.selection ?? []))
    return () => {
      const current = { cam: state.current.cam, selection: [...state.current.selection] }
      storedViews.set(cacheKey, current)
      try { localStorage.setItem(`noteboard:view:${cacheKey}`, JSON.stringify(current)) } catch {}
    }
  }, [cacheKey])
  useEffect(() => {
    const element = board.current
    if (!element) return
    const resize = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }))
    resize.observe(element)
    const wheel = (e: WheelEvent) => {
      if (inputTarget(e.target)) return
      e.preventDefault()
      const r = element.getBoundingClientRect()
      setCam((c) => e.ctrlKey || e.metaKey ? zoomAt(c, Math.exp(-e.deltaY * .002), e.clientX - r.left, e.clientY - r.top) : { ...c, x: c.x - e.deltaX, y: c.y - e.deltaY })
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => { resize.disconnect(); element.removeEventListener('wheel', wheel) }
  }, [Boolean(data)])
  useLayoutEffect(() => {
    const root = rootElement.current
    if (!root) return
    return props.composer.attach(props.sessionId, root, tools)
  }, [Boolean(data), props.composer, props.sessionId])
  useEffect(() => { props.composer.update(props.sessionId, { toolMode: mode }); props.composer.refresh(props.sessionId) }, [mode, placement, props.composer, props.sessionId])
  useLayoutEffect(() => {
    const root = rootElement.current, element = board.current
    if (!root || !element) return
    const host = root.closest('[data-conversation-scroll]')
    const surfaces = [...root.querySelectorAll<HTMLElement>('.nb-canvas-controls,.nb-view-tools,.nb-fallback-tools,.nb-drawer'), ...(host ? host.querySelectorAll<HTMLElement>('[data-composer-seat]') : [])]
    const measure = () => {
      const r = element.getBoundingClientRect(), next = { top: 16, right: 16, bottom: 16, left: 16 }
      for (const surface of surfaces) {
        const s = surface.getBoundingClientRect()
        if (!s.width || !s.height || s.bottom <= r.top || s.top >= r.bottom) continue
        if (surface.matches('.nb-canvas-controls,.nb-view-tools')) next.top = Math.max(next.top, s.bottom - r.top + 16)
        else if (surface.matches('.nb-drawer')) next.right = Math.max(next.right, r.right - s.left + 16)
        else next.bottom = Math.max(next.bottom, r.bottom - s.top + 16)
      }
      setInsets((old) => Object.keys(next).every((k) => Math.abs(old[k as keyof typeof old] - next[k as keyof typeof next]) < 1) ? old : next)
    }
    const resize = new ResizeObserver(measure); resize.observe(element); surfaces.forEach((s) => resize.observe(s)); measure()
    return () => resize.disconnect()
  }, [Boolean(data), drawer, dock.available, dock.expanded, dock.takeover])
  const safeArea = () => ({ x: insets.left, y: insets.top, width: Math.max(100, size.width - insets.left - insets.right), height: Math.max(60, size.height - insets.top - insets.bottom) })
  function center() { const a = safeArea(); return screenToBoard(state.current.cam, a.x + a.width / 2, a.y + a.height / 2) }
  function fit() { const a = safeArea(), c = fitCamera(state.current.nodes, a.width, a.height, 24); setCam({ ...c, x: c.x + a.x, y: c.y + a.y }) }
  function focus(id: string) {
    const node = state.current.nodes.find((n) => n.id === id)
    if (!node) return
    const a = safeArea(), z = Math.max(.7, Math.min(state.current.cam.z, 1.3))
    setCam({ z, x: a.x + a.width / 2 - (node.x + node.width / 2) * z, y: a.y + a.height / 2 - (node.y + node.height / 2) * z })
    setSelection(new Set([id])); setPulse(id)
  }
  useEffect(() => { if (!pulse) return; const timer = setTimeout(() => setPulse(''), 1800); return () => clearTimeout(timer) }, [pulse])
  useEffect(() => {
    props.integration?.registerView(props.sessionId, { openView: props.openView, focus, reload, root: cwd })
    return () => props.integration?.unregisterView(props.sessionId)
  }, [props.sessionId, props.openView, cwd, data, size, drawer])
  useEffect(() => {
    if (data && props.viewRequest?.view === 'noteboard' && props.viewRequest.focus) { focus(props.viewRequest.focus); props.completeViewRequest?.() }
  }, [data, props.viewRequest])
  function act(method: string, args: any = {}) {
    const canvasName = args.canvasName ?? activeName
    if (['saveAsNew', 'writeCanvas', 'rearrange', 'layout', 'addNotes', 'removeNotes'].includes(method)) args = { ...args, canvasName }
    const followsTextSave = textEditing && ['switchCanvas', 'saveAsNew', 'deleteCanvas', 'restoreOperation', 'rearrange'].includes(method)
    const predecessor = followsTextSave ? writes.current : writes.current.catch(() => {})
    const work = predecessor.then(async () => {
      try {
        setError(''); const saved = await flushLayout(cwd, canvasName)
        if (args.canvasVersion) args = { ...args, canvasVersion: saved?.canvasVersion ?? (state.current.data?.meta.activeCanvas === canvasName ? state.current.data?.canvasVersion : args.canvasVersion) }
        const result = await rpc(cwd, method, args)
        await reload(); setStatus(result.operationId ? '已保存' : '')
        if (drawer === 'history') setRecords(await rpc(cwd, 'history'))
        return result
      } catch (e: any) { setError(e.message); throw e }
    })
    writes.current = work
    return work
  }
  function action(method: string, args: any = {}) { void act(method, args).catch(() => {}) }
  const selectedNotes = useMemo(() => (data?.notes ?? []).filter((n) => selection.has(n.id) && nodes.some((x) => x.id === n.id)), [data, selection, nodes])
  const selectedNodes = useMemo(() => nodes.filter((n) => selection.has(n.id)), [nodes, selection])
  async function nodeAction(method: string, args: any = {}) {
    if (method === 'updateText' && args.patch?.fontSize) {
      const node = nodes.find((n) => n.id === args.id)
      if (node) args.patch.height = textHeight(nodeText(node), node.width, args.patch.fontSize, rootElement.current)
    }
    const result = await act(method, { canvasName: activeName, canvasVersion: data?.canvasVersion, ...args })
    if (result.node) setSelection(new Set([result.node.id]))
    if (method === 'removeNodes') setSelection(new Set())
    return result
  }
  function runNodeAction(method: string, args: any = {}) { void nodeAction(method, args).catch(() => {}) }
  async function addReferences() {
    try {
      if (!props.integration) throw new Error('宿主不支持便签引用')
      await props.integration.addReferences(props.sessionId, cwd, activeName, selectedNotes)
      setStatus('已加入对话')
      if (dock.available) props.composer.expand(props.sessionId)
      else await props.composer.openChat(props.sessionId)
    } catch (e: any) { setError(e.message) }
  }
  function batch(method: string, args: any) {
    action(method, { ids: selectedNotes.map((n) => n.id), versions: Object.fromEntries(selectedNotes.map((n) => [n.id, n.version])), canvasName: activeName, canvasVersion: data?.canvasVersion, ...args })
  }
  function newNote(point = center()) {
    setPlacement(false)
    void (textEditing ? writes.current : writes.current.catch(() => {})).then(() => flushLayout(cwd, activeName)).then(() => { setEditing({ position: { x: snap(point.x - CARD_W / 2), y: snap(point.y - CARD_H / 2) } }); setMenu(false) }).catch((e) => setError(e.message))
  }
  tools.current = { cancelPlacement: () => setPlacement(false), tools: () => ({ mode, placement, onMode: (next: 'select' | 'pan') => { setPlacement(false); setMode(next); board.current?.focus() }, onNote: () => newNote(), onText: () => { setPlacement((value) => !value); setMode('select'); board.current?.focus() } }) }
  function editText(node: NbNode) { setTextEditing(node); setSelection(new Set([node.id])); setPlacement(false) }
  function savePositions() {
    setStatus('保存中…')
    queueLayout(cwd, activeName, { canvasName: activeName, canvasVersion: state.current.data?.canvasVersion, canvas: { nodes: state.current.nodes } }, (err) => {
      if (!mounted.current) return
      if (err) { setError(err); setStatus('尚未保存') }
      else { setStatus('已保存'); void reload().catch((e) => setError(e.message)) }
    })
  }
  function begin(e: React.PointerEvent, node?: NbNode) {
    if (inputTarget(e.target)) return
    if (e.button !== 0 && e.button !== 1) return
    if (!node && e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('nb-world')) return
    e.preventDefault(); e.stopPropagation(); board.current?.focus()
    if (placement && e.button === 0 && !space.current) {
      const r = board.current!.getBoundingClientRect(), point = screenToBoard(cam, e.clientX - r.left, e.clientY - r.top)
      editText({ id: '', type: 'text', text: '', x: snap(point.x), y: snap(point.y), width: 260, height: 30, noteboard: { kind: 'text', fontSize: 20 } }); return
    }
    const c = state.current, kind = e.button === 1 || space.current || effectiveMode === 'pan' ? 'pan' : node ? 'cards' : 'select'
    const toggle = e.shiftKey || e.metaKey || e.ctrlKey
    const ids = new Set(c.selection)
    if (node && kind === 'cards') {
      if (toggle) { ids.has(node.id) ? ids.delete(node.id) : ids.add(node.id) }
      else if (!ids.has(node.id)) { ids.clear(); ids.add(node.id) }
      setSelection(ids)
    }
    gesture.current = { kind, sx: e.clientX, sy: e.clientY, cam: { ...c.cam }, nodes: c.nodes, original: c.selection, ids, moved: false, additive: e.shiftKey, clicked: node?.id, toggle }
    board.current?.setPointerCapture(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    const g = gesture.current, r = board.current?.getBoundingClientRect()
    if (!g || !r) return
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy
    if (Math.hypot(dx, dy) < 4 && !g.moved) return
    g.moved = true; setDragging(true)
    if (g.kind === 'pan') setCam({ ...g.cam, x: g.cam.x + dx, y: g.cam.y + dy })
    else if (g.kind === 'select') {
      const a = screenToBoard(g.cam, Math.min(g.sx, e.clientX) - r.left, Math.min(g.sy, e.clientY) - r.top)
      const rect = { x: a.x, y: a.y, width: Math.abs(dx) / g.cam.z, height: Math.abs(dy) / g.cam.z }
      setMarquee(rect); setSelection(new Set([...(g.additive ? g.original : []), ...marqueeHits(g.nodes, rect)]))
    } else {
      const changed = g.nodes.map((n) => g.ids.has(n.id) ? { ...n, x: n.x + snap(dx / g.cam.z), y: n.y + snap(dy / g.cam.z) } : n)
      const next = [...changed.filter((n) => !g.ids.has(n.id)), ...changed.filter((n) => g.ids.has(n.id))]
      state.current.nodes = next; setNodes(next)
    }
  }
  function finish(cancel = false) {
    const g = gesture.current; gesture.current = null; setDragging(false); setMarquee(null)
    if (!g) return
    if (cancel) { setNodes(g.nodes); setSelection(g.original); setCam(g.cam); return }
    if (g.kind === 'cards' && g.moved) savePositions()
    else if (!g.moved && g.kind === 'select') { setSelection(new Set()); setMenu(false) }
    else if (!g.moved && g.kind === 'cards' && !g.toggle && g.clicked) setSelection(new Set([g.clicked]))
  }
  useEffect(() => {
    const reset = () => { space.current = false; finish(true) }
    window.addEventListener('blur', reset)
    return () => window.removeEventListener('blur', reset)
  }, [])
  const selectionBounds = useMemo(() => {
    const ns = nodes.filter((n) => selection.has(n.id))
    if (!ns.length) return null
    const x = Math.min(...ns.map((n) => n.x)) * cam.z + cam.x, y = Math.min(...ns.map((n) => n.y)) * cam.z + cam.y
    return { x, y, width: Math.max(...ns.map((n) => n.x + n.width)) * cam.z + cam.x - x, height: Math.max(...ns.map((n) => n.y + n.height)) * cam.z + cam.y - y }
  }, [selection, nodes, cam])
  const noteMap = useMemo(() => new Map(data?.notes.map((n) => [n.id, n])), [data])
  const results = (data?.notes ?? []).filter((n) => (!offboard || !nodes.some((x) => x.id === n.id)) && `${n.title}\n${n.body}\n${n.tags.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  if (!cwd || !data) return <div className="nb-root nb-loading"><StickyNote size={28}/><p>{error || '正在打开画布…'}</p>{error && <button className="nb-button" onClick={() => void reload().catch((e) => setError(e.message))}>重试</button>}</div>
  return <div ref={rootElement} className="nb-root" onKeyDown={(e) => {
    if (inputTarget(e.target)) return
    if (e.code === 'Space') { e.preventDefault(); space.current = true }
    if (e.key === 'Escape') { setMenu(false); setDrawer(''); setZoomMenu(false); setPlacement(false); setSelection(new Set()) }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelection(new Set(nodes.filter((n) => ['note', 'text', 'heading'].includes(nodeKind(n))).map((n) => n.id))) }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (selectedNodes.length) runNodeAction('removeNodes', { ids: selectedNodes.map((n) => n.id) }) }
    if (e.key === 'Enter' && selectedNodes.length === 1) { e.preventDefault(); selectedNotes.length ? setEditing({ note: selectedNotes[0] }) : editText(selectedNodes[0]) }
  }} onKeyUp={(e) => { if (e.code === 'Space') space.current = false }}>
    <div className={`nb-board${effectiveMode === 'pan' ? ' nb-pan-mode' : ''}${placement ? ' nb-place-text' : ''}`} ref={board} tabIndex={0} aria-label="便签画布" onPointerDown={(e) => begin(e)} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onDoubleClick={(e) => {
      if (textEditing || inputTarget(e.target)) return
      const textHit = document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest<HTMLElement>('[data-text-id]')).find(Boolean)
      if (textHit) { const node = nodes.find((n) => n.id === textHit.dataset.textId); if (node) editText(node); return }
      const hit = document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest<HTMLElement>('[data-note-id]')).find(Boolean)
      if (hit) { const note = noteMap.get(hit.dataset.noteId!); if (note) setEditing({ note }); return }
      if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('nb-world')) return
      const r = board.current!.getBoundingClientRect(); newNote(screenToBoard(cam, e.clientX - r.left, e.clientY - r.top))
    }}>
      <div className="nb-grid" style={{ backgroundSize: `${24 * cam.z}px ${24 * cam.z}px`, backgroundPosition: `${cam.x}px ${cam.y}px`, opacity: Math.min(1, cam.z * 1.6) }}/>
      <div className="nb-world" style={{ transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.z})` }}>
        {nodes.map((node) => {
          if (['text', 'heading'].includes(nodeKind(node))) return textEditing?.id === node.id ? null : <div key={node.id} data-text-id={node.id} className={`nb-text color-${node.noteboard?.color ?? 'gray'}${selection.has(node.id) ? ' nb-selected' : ''}`} style={{ left: node.x, top: node.y, width: node.width, minHeight: node.height, fontSize: node.noteboard?.fontSize ?? (nodeKind(node) === 'heading' ? 14 : 20) }} onPointerDown={(e) => begin(e, node)} onDoubleClick={(e) => { e.stopPropagation(); editText(node) }}><div className="nb-text-content">{nodeText(node)}</div></div>
          if (nodeKind(node) === 'unknown') return null
          const note = noteMap.get(node.id)
          return <div key={node.id} data-note-id={node.id} className={`nb-card color-${note?.color ?? 'gray'}${selection.has(node.id) ? ' nb-selected' : ''}${tagFocus && !note?.tags.includes(tagFocus) ? ' nb-faded' : ''}${pulse === node.id ? ' nb-pulse' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height }} onPointerDown={(e) => begin(e, node)} onDoubleClick={(e) => { e.stopPropagation(); if (note) setEditing({ note }) }}>
            <div className="nb-card-title">{note?.title || (note ? '未命名' : '便签文件不存在')}</div>
            <NoteBody body={note?.body ?? ''}/>
            {Boolean(note?.tags.length) && <div className="nb-card-tags">{note!.tags.slice(0, 2).map((t) => <button className="nb-tag" key={t} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setTagFocus(tagFocus === t ? '' : t) }}>{t}</button>)}{note!.tags.length > 2 && <span className="nb-tag">+{note!.tags.length - 2}</span>}</div>}
          </div>
        })}
        {textEditing && <TextEditor key={textEditing.id || 'new-text'} node={textEditing} onCancel={() => setTextEditing(null)} onSave={async (text, height) => {
          await nodeAction(textEditing.id ? 'updateText' : 'createText', textEditing.id ? { id: textEditing.id, patch: { text, height } } : { text, height, x: textEditing.x, y: textEditing.y })
          setTextEditing(null); setMode('select')
        }}/>}
        {marquee && <div className="nb-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }}/>}
      </div>
      {!nodes.length && <div className="nb-empty"><StickyNote size={38} strokeWidth={1.2}/><h2>{activeName}</h2><button className="nb-button nb-primary" onClick={() => newNote()}><Plus size={16}/>新建便签</button></div>}
    </div>
    <div className="nb-chrome">
      <div className="nb-float nb-canvas-controls"><StickyNote size={18}/><select aria-label="激活画布" value={activeName} onChange={(e) => action('switchCanvas', { name: e.target.value })}>{data.canvases.map((n) => <option key={n}>{n}</option>)}</select>{status && <span className="nb-save-status" role="status">{status}</span>}<IconButton icon={MoreHorizontal} label="画布菜单" active={menu} onClick={() => setMenu(!menu)}/>
        {menu && <div className="nb-dropdown nb-menu-list">
          <button onClick={() => { setSaveAs(true); setName(''); setMenu(false) }}><FilePlus2 size={16}/>另存为新画布</button>
          <button onClick={() => { action('rearrange', { canvasName: activeName, canvasVersion: data.canvasVersion }); setMenu(false) }}><LayoutGrid size={16}/>按标签重排</button>
          <button onClick={() => { action('rearrange', { canvasName: activeName, canvasVersion: data.canvasVersion, regenerateHeadings: true }); setMenu(false) }}><RefreshCw size={16}/>重新生成分类标题</button>
          <button onClick={() => { setDrawer('history'); setMenu(false); void rpc(cwd, 'history').then(setRecords).catch((e) => setError(e.message)) }}><History size={16}/>操作记录</button>
          <button className="nb-danger" disabled={data.canvases.length <= 1} onClick={() => { if (confirm(`删除画布「${activeName}」？便签文件保留。`)) { action('deleteCanvas', { name: activeName }); setMenu(false) } }}><Trash2 size={16}/>删除画布</button>
        </div>}
      </div>
      <div className="nb-float nb-view-tools">
        <IconButton icon={Search} label="搜索便签" active={drawer === 'search'} onClick={() => { setDrawer(drawer === 'search' ? '' : 'search'); setOffboard(false) }}/><span className="nb-rule"/>
        <span className="nb-zoom-step"><IconButton icon={Minus} label="缩小" onClick={() => setCam(zoomAt(cam, .8, size.width / 2, size.height / 2))}/></span>
        <button className="nb-zoom-value" title="缩放菜单" aria-label="缩放菜单" aria-expanded={zoomMenu} onClick={() => setZoomMenu(!zoomMenu)}>{Math.round(cam.z * 100)}%</button>
        <span className="nb-zoom-step"><IconButton icon={Plus} label="放大" onClick={() => setCam(zoomAt(cam, 1.25, size.width / 2, size.height / 2))}/></span>
        <IconButton icon={Scan} label="全览" onClick={fit}/>
        {zoomMenu && <div className="nb-dropdown nb-menu-list nb-zoom-menu"><button onClick={() => setCam(zoomAt(cam, 1.25, size.width / 2, size.height / 2))}>放大</button><button onClick={() => setCam(zoomAt(cam, .8, size.width / 2, size.height / 2))}>缩小</button><button onClick={() => { setCam({ ...RESET_CAM }); setZoomMenu(false) }}>复位视图</button></div>}
      </div>
      {!dock.available && !dock.takeover && <div className="nb-float nb-fallback-tools"><BoardTools {...tools.current.tools()} status={dock.status} onAI={() => void props.composer.openChat(props.sessionId)}/></div>}
      {tagFocus && <button className="nb-focus-filter nb-button" onClick={() => setTagFocus('')}>{tagFocus}<X size={14}/></button>}
    </div>
    {(error || dock.error) && <div className="nb-alert" role="alert"><span>{error || dock.error}</span>{pendingLayout(cwd, activeName) && <IconButton icon={RefreshCw} label="重试保存" onClick={() => void flushLayout(cwd, activeName).then(() => { setError(''); void reload() }).catch((e) => setError(e.message))}/>}<IconButton icon={X} label="关闭提示" onClick={() => { setError(''); props.composer.update(props.sessionId, { error: '' }) }}/></div>}
    {selectionBounds && selectedNodes.length > 0 && !dragging && !editing && !textEditing && !drawer && selectionBounds.x < size.width && selectionBounds.y < size.height && selectionBounds.x + selectionBounds.width > 0 && selectionBounds.y + selectionBounds.height > 0 && (selectedNotes.length === selectedNodes.length ? <CardMenu bounds={selectionBounds} board={board.current} padding={insets} notes={selectedNotes} onAction={batch} onEdit={() => setEditing({ note: selectedNotes[0] })} onSource={() => setSource(selectedNotes[0])} onReference={() => void addReferences()} onClose={() => setSelection(new Set())}/> : <NodeMenu bounds={selectionBounds} board={board.current} padding={insets} nodes={selectedNodes} noteCount={selectedNotes.length} onAction={runNodeAction} onEdit={() => editText(selectedNodes[0])} onReference={() => void addReferences()}/>)}
    {drawer && <aside className="nb-drawer" style={{ bottom: Math.max(16, insets.bottom), top: insets.top }}><header><strong>{drawer === 'history' ? '操作记录' : '搜索便签'}</strong><IconButton icon={X} label="关闭侧栏" onClick={() => setDrawer('')}/></header>
      {drawer === 'history' ? <div className="nb-results">{records.length === 0 && <p className="nb-muted">暂无操作记录</p>}{records.map((r) => <div className="nb-result" key={r.id}><button onClick={() => void rpc(cwd, 'history', { id: r.id }).then(setRecord)}><strong>{r.label}</strong><small>{new Date(r.created).toLocaleString()} · {r.changedFiles} 个文件 · {r.status}</small></button><IconButton icon={RotateCcw} label="恢复此操作" disabled={r.status === 'restored'} onClick={() => action('restoreOperation', { id: r.id })}/></div>)}</div> : <><input className="nb-search-input" autoFocus aria-label="搜索标题、正文或标签" placeholder="搜索便签…" value={query} onChange={(e) => setQuery(e.target.value)}/><div className="nb-tabs"><button aria-selected={!offboard} onClick={() => setOffboard(false)}>全部</button><button aria-selected={offboard} onClick={() => setOffboard(true)}>未在此画布</button></div><div className="nb-results">{results.length === 0 && <p className="nb-muted">没有匹配的便签</p>}{results.map((note) => {
        const onBoard = nodes.some((n) => n.id === note.id)
        return <div className="nb-result" key={note.id}><span className={`nb-color-indicator color-${note.color}`}/><button onClick={() => onBoard ? (setDrawer(''), focus(note.id)) : setEditing({ note })}><strong>{note.title}</strong><small>{note.body.slice(0, 90)}</small><small>{onBoard ? '在此画布' : '未在此画布'}</small></button><IconButton icon={onBoard ? ArrowUpRight : Plus} label={onBoard ? '定位便签' : '加入画布'} onClick={() => onBoard ? (setDrawer(''), focus(note.id)) : action('addNotes', { ids: [note.id], canvasName: activeName, center: center() })}/></div>
      })}</div></>}
    </aside>}
    {editing && <NoteEditor note={editing.note} position={editing.position} cwd={cwd} canvasName={activeName} onClose={() => setEditing(null)} onDone={(r: any) => { setEditing(null); setStatus('已保存'); void reload().then(() => { if (r.note) setSelection(new Set([r.note.id])) }) }}/>}
    {saveAs && <Dialog title="另存为新画布" onClose={() => setSaveAs(false)}><form className="nb-form" onSubmit={(e) => { e.preventDefault(); void act('saveAsNew', { name: name.trim() || undefined }).then(() => setSaveAs(false)).catch(() => {}) }}><input aria-label="新画布名" placeholder={`${activeName}-副本`} value={name} onChange={(e) => setName(e.target.value)}/>{error && <p className="nb-error">{error}</p>}<button className="nb-button nb-primary">保存</button></form></Dialog>}
    {source && <Dialog title="原文与依据" onClose={() => setSource(null)}><div className="nb-source"><p className="nb-muted">{source.source?.label || '画布内新建'}</p>{source.source?.text && <blockquote>{source.source.text}</blockquote>}{source.source?.sessionId && <button className="nb-button nb-primary" onClick={() => {
      if (!props.integration) { setError('宿主来源导航不可用'); return }
      void props.integration.openSource(source, { sessionId: props.sessionId, cwd, canvasName: activeName, noteId: source.id }).then(() => setSource(null)).catch((e: any) => setError(e.message))
    }}><LinkIcon/>查看原文</button>}{source.derivedFrom?.map((id) => <button className="nb-button" key={id} onClick={() => { const note = noteMap.get(id); if (note) { setSource(null); setEditing({ note }) } }}>{noteMap.get(id)?.title ?? `依据 ${id}（已不可用）`}</button>)}{error && <p className="nb-error">{error}</p>}</div></Dialog>}
    {record && <Dialog title={record.label} onClose={() => setRecord(null)} wide><div className="nb-history-diff">{record.files.map((f: any) => <section key={f.path}><strong>{f.path}</strong><div><pre>{f.before ?? '（不存在）'}</pre><pre>{f.after ?? '（已移除）'}</pre></div></section>)}</div><footer><button className="nb-button" onClick={() => void act('restoreOperation', { id: record.id }).then(() => setRecord(null)).catch(() => {})}><RotateCcw size={15}/>恢复此操作</button></footer>{error && <p className="nb-error">{error}</p>}</Dialog>}
  </div>
}
function LinkIcon() { return <ArrowUpRight size={15}/> }
