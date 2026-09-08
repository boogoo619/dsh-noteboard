import React, { useEffect, useRef, useState } from 'react'
import { Check, X, Sparkles, Plus, ArrowUpRight, AlertCircle, RotateCcw, LoaderCircle } from 'lucide-react'
import { rpc } from '../api'
import { IconButton } from '../ui'
import { titleFromText, type SourceFragment } from '../types'

export function currentSessionOf(sessions: any) {
  const s = sessions?.list?.getSnapshot(), sessionId = s?.current
  return { sessionId, cwd: s?.byId?.[sessionId]?.cwd, title: s?.byId?.[sessionId]?.title ?? '' }
}
type Capture = { x: number; y: number; text: string; source: any; root: string; sessionId: string }
type Notice = { id: string; kind: 'ok' | 'error' | 'pending'; text: string; task: Capture; canvasName?: string; noteId?: string; action: 'direct' | 'distill'; expires?: number }
export function captureSelection(sessions: any, integration?: any): Capture | null {
  const selection = window.getSelection(), current = currentSessionOf(sessions)
  if (!selection?.rangeCount || selection.isCollapsed || !current.cwd || !current.sessionId) return null
  const range = selection.getRangeAt(0)
  const start = range.startContainer.parentElement, end = range.endContainer.parentElement
  if (!start?.closest('[data-chat-anchor-key]') || !end?.closest('[data-chat-anchor-key]') || start.closest('input,textarea,[contenteditable=true],.nb-overlay')) return null
  const fragments: SourceFragment[] = []
  for (const row of document.querySelectorAll<HTMLElement>('[data-chat-anchor-key]')) {
    if (!range.intersectsNode(row)) continue
    const local = document.createRange(); local.selectNodeContents(row)
    if (row.contains(range.startContainer)) local.setStart(range.startContainer, range.startOffset)
    if (row.contains(range.endContainer)) local.setEnd(range.endContainer, range.endOffset)
    const text = local.toString(); if (!text.trim()) continue
    const prefix = document.createRange(); prefix.selectNodeContents(row); prefix.setEnd(local.startContainer, local.startOffset)
    const offset = prefix.toString().length, full = row.textContent ?? ''
    const key = row.dataset.chatAnchorKey!
    const seq = Number(row.dataset.seq ?? row.dataset.messageSeq ?? integration?.anchorSeq(current.sessionId, key))
    const turn = Number(row.dataset.chatTurn)
    fragments.push({ key, ...(Number.isFinite(seq) ? { seq } : {}), ...(Number.isFinite(turn) ? { turn } : {}), text, start: offset, end: offset + text.length, prefix: full.slice(Math.max(0, offset - 48), offset), suffix: full.slice(offset + text.length, offset + text.length + 48) })
  }
  if (!fragments.length) return null
  const r = range.getBoundingClientRect(), text = range.toString()
  return { x: Math.max(120, Math.min(innerWidth - 120, r.left + r.width / 2)), y: r.top >= 52 ? r.top - 48 : r.bottom + 8,
    text, root: current.cwd, sessionId: current.sessionId,
    source: { sessionId: current.sessionId, label: `${current.title || '对话'} · ${new Date().toLocaleString()}`, text, fragments } }
}
export function CaptureOverlay({ sessions, integration }: any) {
  const [capture, setCapture] = useState<Capture | null>(null), [notices, setNotices] = useState<Notice[]>([])
  const [expanded, setExpanded] = useState(false), [paused, setPaused] = useState(false), [revision, update] = useState(0)
  const busy = useRef(new Set<string>()), alive = useRef(true), pauseStart = useRef(0)
  const [position, setPosition] = useState({ x: innerWidth / 2, y: 96 })
  useEffect(() => {
    alive.current = true
    const selection = () => { if (!busy.current.size) setCapture(captureSelection(sessions, integration)) }
    const down = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.nb-overlay')) setCapture(null) }
    const scroll = () => setCapture(null)
    document.addEventListener('mouseup', selection)
    document.addEventListener('keyup', selection)
    document.addEventListener('pointerdown', down)
    document.addEventListener('scroll', scroll, true)
    const unsubscribe = integration.subscribe(() => update((n) => n + 1))
    const resize = () => {
      const surface = document.querySelector<HTMLElement>('.nb-root') ?? document.querySelector<HTMLElement>('[data-chat-flow]')
      const r = surface?.getBoundingClientRect()
      setPosition({ x: r ? r.left + r.width / 2 : innerWidth / 2, y: r ? Math.max(76, r.top + (surface?.classList.contains('nb-root') ? 120 : 12)) : 96 })
    }
    const observer = new ResizeObserver(resize); observer.observe(document.body); resize()
    return () => { alive.current = false; document.removeEventListener('mouseup', selection); document.removeEventListener('keyup', selection); document.removeEventListener('pointerdown', down); document.removeEventListener('scroll', scroll, true); unsubscribe(); observer.disconnect() }
  }, [sessions, integration])
  useEffect(() => {
    if (paused) { pauseStart.current = Date.now(); return }
    if (pauseStart.current) { const elapsed = Date.now() - pauseStart.current; setNotices((ns) => ns.map((n) => n.expires ? { ...n, expires: n.expires + elapsed } : n)); pauseStart.current = 0 }
    const timer = setInterval(() => setNotices((ns) => ns.filter((n) => !n.expires || n.expires > Date.now())), 500)
    return () => clearInterval(timer)
  }, [paused])
  async function run(task: Capture, action: 'direct' | 'distill', retry?: Notice) {
    const key = `${task.root}\n${task.sessionId}\n${task.text}`
    if (busy.current.has(key)) return
    busy.current.add(key)
    const id = retry?.id ?? crypto.randomUUID()
    let canvasName = retry?.canvasName
    setNotices((ns) => [...ns.filter((n) => n.id !== id), { id, task, action, kind: 'pending', text: action === 'distill' ? '正在提炼…' : '正在存入…' }])
    try {
      const state = await rpc(task.root, 'state'); canvasName ??= state.meta.activeCanvas
      const result = await rpc(task.root, action === 'direct' ? 'createNote' : 'distillNote', { canvasName, source: task.source, ...(action === 'direct' ? { title: titleFromText(task.text), body: task.text } : { text: task.text }) })
      if (alive.current) { setCapture(null); window.getSelection()?.removeAllRanges(); setNotices((ns) => ns.map((n) => n.id === id ? { ...n, canvasName, kind: 'ok', text: `${action === 'distill' ? '已提炼' : '已存入'}：${result.note.title}`, noteId: result.note.id, expires: Date.now() + (action === 'distill' ? 10000 : 5000) } : n)) }
    } catch (e: any) {
      if (alive.current) setNotices((ns) => ns.map((n) => n.id === id ? { ...n, canvasName, kind: 'error', text: e.message } : n))
    } finally { busy.current.delete(key) }
  }
  const returnTo = integration.getReturn()
  return <div className="nb-overlay">
    {capture && <div className="nb-capture" style={{ left: capture.x, top: capture.y, transform: 'translateX(-50%)' }} onMouseDown={(e) => e.preventDefault()}>
      <button className="nb-button" disabled={busy.current.size > 0} onClick={() => void run(capture, 'direct')}><Plus size={15}/>存入画布</button><button className="nb-button" disabled={busy.current.size > 0} onClick={() => void run(capture, 'distill')}><Sparkles size={15}/>AI 提炼</button>
    </div>}
    {notices.length > 0 && <div className="nb-notices" role="status" aria-live="polite" style={{ left: position.x, top: position.y }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false) }}>
      {notices.length > 1 && <button className="nb-notice-more" onClick={() => setExpanded(!expanded)}>{notices.length} 项操作 · {expanded ? '收起' : '展开'}</button>}
      {(expanded ? notices : notices.slice(-1)).map((n) => <div className="nb-notice" key={n.id}>{n.kind === 'ok' ? <Check size={16}/> : n.kind === 'error' ? <AlertCircle size={16}/> : <LoaderCircle size={16}/>}<span className="nb-notice-text">{n.text}</span><div className="nb-notice-actions">
        {n.kind === 'ok' && <IconButton icon={ArrowUpRight} label="查看便签" onClick={() => void integration.openCanvas(n.task.sessionId, n.task.root, n.canvasName, n.noteId).catch((e: any) => setNotices((ns) => ns.map((x) => x.id === n.id ? { ...x, kind: 'error', text: e.message, expires: undefined } : x)))}/>}
        {n.kind === 'error' && <><IconButton icon={RotateCcw} label="重试" onClick={() => void run(n.task, n.action, n)}/>{n.action === 'distill' && <button className="nb-button" onClick={() => void run(n.task, 'direct', n)}>存入原文</button>}</>}
        {n.kind !== 'pending' && <IconButton icon={X} label="关闭通知" onClick={() => setNotices((ns) => ns.filter((x) => x.id !== n.id))}/>}
      </div></div>)}
    </div>}
    {returnTo && !notices.length && <button className="nb-return nb-button" onClick={() => void integration.goBack()}><RotateCcw size={15}/>{integration.getMessage() || '查看来源'} · 返回便签</button>}
  </div>
}
