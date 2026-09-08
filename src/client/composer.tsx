import React, { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, ArrowUpRight, BotMessageSquare, ChevronDown, Hand, LoaderCircle, MousePointer2, Square, StickyNote, Type, X } from 'lucide-react'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import { IconButton } from './ui'
import { createReplyTracker, type Reply } from './replies'

const SendIcon = primitives.IconSendOutline14 ?? ArrowUp
const CollapseIcon = primitives.IconChevronDownOutline14 ?? ChevronDown

type DockState = { active: boolean; expanded: boolean; available: boolean; takeover: boolean; focus: number; toolsVersion: number; toolMode: 'select' | 'pan'; status: string; error: string }
const EMPTY: DockState = { active: false, expanded: false, available: false, takeover: false, focus: 0, toolsVersion: 0, toolMode: 'select', status: '', error: '' }
export function createComposer(ctx: any, integration: any) {
  const states = new Map<string, DockState>(), listeners = new Set<() => void>()
  const boards = new Map<string, { element: HTMLElement; actions: any }>()
  let compatibilityError = ''
  const api = {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    snapshot(id: string): DockState { return states.get(id) ?? EMPTY },
    update(id: string, patch: Partial<DockState>) {
      const previous = api.snapshot(id)
      if (Object.entries(patch).every(([k, v]) => previous[k as keyof DockState] === v)) return
      states.set(id, { ...previous, ...patch }); listeners.forEach((fn) => fn())
    },
    attach(id: string, element: HTMLElement, actions: any) {
      const board = { element, actions }; boards.set(id, board); api.update(id, { active: true })
      const timer = setTimeout(() => { if (!api.snapshot(id).available) api.update(id, { error: compatibilityError || '当前 Harness 输入区不兼容，已保留原生输入框' }) }, 1500)
      return () => { clearTimeout(timer); if (boards.get(id) === board) { boards.delete(id); api.update(id, { active: false }) } }
    },
    board(id: string) { return boards.get(id) },
    refresh(id: string) { api.update(id, { toolsVersion: api.snapshot(id).toolsVersion + 1 }) },
    expand(id: string) { api.update(id, { expanded: true, focus: api.snapshot(id).focus + 1 }); boards.get(id)?.actions.current.cancelPlacement() },
    collapse(id: string) { api.update(id, { expanded: false }); boards.get(id)?.element.querySelector<HTMLElement>('.nb-board')?.focus({ preventScroll: true }) },
    openChat(id: string) { return integration.openView(id, 'chat').catch((e: Error) => api.update(id, { error: e.message })) },
    replySource(id: string) { return ctx.get('uiConversation')?.binding(id)?.target('chat') },
  }
  let registration: (() => void) | undefined
  const stop = ctx.slots.inject('conversation.input.left', () => {
    let installing = false
    const install = () => {
      if (registration || installing) return
      const owner = ctx.slots.entriesOfSlot('conversation.composer.bar')[0]
      if (!owner?.component || !owner.inject || !owner.children) return
      installing = true
      try {
        // Borrow the owner's operations, never redeclare its children or remount its editor.
        registration = ctx.slots.register({ name: 'conversation.input.left', id: 'noteboard-composer', inject: owner.inject, locale: owner.locale },
          (props: any) => <ComposerAdapter {...props} dock={api}/>)
      } catch { compatibilityError = '当前 Harness 输入区不兼容，已保留原生输入框' }
      finally { installing = false }
    }
    const unsubscribe = ctx.slots.subscribe('conversation.composer.bar', install)
    install()
    return () => { unsubscribe(); registration?.(); registration = undefined }
  })
  ctx.effect(() => () => { stop(); states.clear(); boards.clear(); listeners.clear() })
  return api
}
export type Composer = ReturnType<typeof createComposer>
export function useDock(dock: Composer, sessionId: string) {
  return useSyncExternalStore(dock.subscribe, () => dock.snapshot(sessionId))
}
export function BoardTools({ mode, placement, onMode, onNote, onText, onAI, status }: any) {
  return <div className="nb-board-tools" role="toolbar" aria-label="画布工具">
    <IconButton icon={MousePointer2} label="选择" active={mode === 'select' && !placement} onClick={() => onMode('select')}/>
    <IconButton icon={Hand} label="平移" active={mode === 'pan' && !placement} onClick={() => onMode('pan')}/>
    <span className="nb-rule"/>
    <IconButton icon={StickyNote} label="新建便签" onClick={onNote}/>
    <IconButton icon={Type} label="新建文本" active={placement} onClick={onText}/>
    <span className="nb-rule"/>
    <button type="button" className="nb-icon nb-ai-entry" aria-label="AI 助手" title={status ? `AI 助手 · ${status}` : 'AI 助手'} onClick={onAI}>
      <BotMessageSquare size={17} strokeWidth={1.7}/>
      {status && (status === '处理中' || status.startsWith('排队') ? <LoaderCircle className="nb-ai-busy" size={11} aria-hidden="true"/> : <span className={`nb-ai-dot${status === '发送失败' ? ' is-error' : ''}`} aria-hidden="true"/>)}
      <span className="nb-sr-only" role="status">{status}</span>
    </button>
  </div>
}

function ComposerAdapter({ dock, ...props }: any) {
  const id = props.sessionId ?? '', state = useDock(dock, id)
  const root = useRef<HTMLSpanElement>(null), selection = useRef<Range | null>(null)
  const [portal, setPortal] = React.useState<HTMLElement | null>(null)
  const [dismissedNotice, setDismissedNotice] = React.useState(0)
  const [reply, setReply] = React.useState<Reply | null>(null)
  const input = props.useInput((s: any) => s), session = props.useSession((s: any) => s)
  const notice = props.useNotices?.((s: any) => s)
  const running = Boolean(session?.running)
  const pending = props.useSessionPendingInteraction?.((s: any) => s.get(id))
  const nativeError = notice?.level === 'error' && notice.seq > dismissedNotice ? notice.text : session?.promptError?.error?.message
  const status = pending ? '待处理' : nativeError ? '发送失败' : input?.queue?.length ? `排队 ${input.queue.length}` : running ? '处理中' : input?.draft || input?.imageIds?.length ? '有草稿' : ''
  useEffect(() => { if (id) dock.update(id, { status }) }, [id, status, dock])
  useLayoutEffect(() => {
    if (!state.active || !root.current) return
    const wrapper = root.current, seat = wrapper.closest<HTMLElement>('[data-composer-seat]')
    const scroll = seat?.closest<HTMLElement>('[data-conversation-scroll]')
    const host = scroll?.closest<HTMLElement>('[data-phase]')
    const body = scroll?.querySelector<HTMLElement>(':scope > [data-slot="conversation.session"]')
    const view = body?.firstElementChild as HTMLElement | null
    if (!seat || !scroll || !host || !body || !view || !props.keyboard?.editor || !seat.querySelector('[data-composer-input]')) {
      dock.update(id, { available: false, error: '当前 Harness 输入区不兼容，已保留原生输入框' }); return
    }
    const controls = document.createElement('div'); controls.className = 'nb-composer-controls'; seat.append(controls); setPortal(controls)
    const elements = [[host, 'nb-host'], [scroll, 'nb-host-scroll'], [seat, 'nb-host-seat'], [body, 'nb-host-session'], [view, 'nb-host-view']] as const
    let lastTakeover: boolean | undefined
    const update = () => {
      const takeover = Boolean(pending || seat.querySelector('[data-conversation-composer-overlay]'))
      if (takeover === lastTakeover) return
      lastTakeover = takeover
      elements.forEach(([el, name]) => el.classList.toggle(name, !takeover))
      dock.update(id, { available: true, error: '', takeover })
    }
    update()
    const observer = new MutationObserver(update); observer.observe(seat, { childList: true, subtree: true })
    const measure = () => {
      const board = dock.board(id)?.element
      if (board) { seat.style.setProperty('--nb-available-height', `${board.clientHeight}px`); seat.style.setProperty('--nb-available-width', `${Math.max(0, board.clientWidth - 32)}px`) }
    }
    const resize = new ResizeObserver(measure); resize.observe(scroll); measure()
    return () => {
      observer.disconnect(); resize.disconnect(); elements.forEach(([el, name]) => el.classList.remove(name))
      controls.remove(); setPortal(null)
      seat.style.removeProperty('--nb-available-height'); seat.style.removeProperty('--nb-available-width'); dock.update(id, { available: false, takeover: false })
    }
  }, [state.active, id, dock, props.keyboard?.editor, pending])
  useLayoutEffect(() => {
    if (!state.active || !state.available || !state.expanded || state.takeover) return
    const editor = props.keyboard?.editor
    editor?.focus(() => {
      const range = selection.current, element = editor.getRootElement()
      if (range && element?.contains(range.startContainer) && element.contains(range.endContainer)) {
        const current = window.getSelection(); current?.removeAllRanges(); current?.addRange(range)
      }
    })
  }, [state.active, state.available, state.expanded, state.focus, state.takeover, props.keyboard])
  const active = state.active && state.available && !state.takeover
  useEffect(() => {
    setReply(null)
    if (!active) return
    const source = dock.replySource(id)
    if (!source?.subscribe) return
    const read = createReplyTracker(source.getSnapshot(), Date.now())
    return source.subscribe(() => { const next = read(source.getSnapshot()); if (next) setReply(next) })
  }, [active, id, dock])
  const board = dock.board(id)
  const controls = board?.actions.current
  const collapse = () => {
    const current = window.getSelection()
    if (current?.rangeCount && props.keyboard?.editor?.getRootElement()?.contains(current.anchorNode)) selection.current = current.getRangeAt(0).cloneRange()
    props.keyboard?.dismissPopup(); dock.collapse(id)
  }
  const empty = !input?.draft?.trim() && !input?.imageIds?.length
  const blocked = props.disabled || props.blocked || session?.removed || (session?.subagent?.address?.mode === 'continuable' && session.subagent.parentAvailable !== true)
  const busy = input?.phase === 'adjudicating' || input?.phase === 'submitting'
  return <><span ref={root} hidden/>{portal && active && createPortal(<div className="nb-composer-adapter nb-composer-custom nb-overlay" data-nb-composer-mode={state.expanded ? 'input' : 'tools'} data-nb-running={running || undefined}>
      {reply && !nativeError && !props.blocked?.reason && <ReplyToast key={reply.turn} reply={reply} onClose={() => setReply(null)} onOpen={() => void dock.openChat(id)}/>}
      {state.expanded && (nativeError || props.blocked?.reason) && <span className="nb-input-status" role="alert">{nativeError || props.blocked.reason}</span>}
      {state.expanded ? <div className="nb-input-actions">
        <IconButton icon={CollapseIcon} label="收起输入，返回画布工具" onMouseDown={(e: React.MouseEvent) => e.preventDefault()} onClick={collapse}/>
        <span className="nb-sr-only" role="status">{status}</span>
        <div className="nb-input-trailing">
          {running && <IconButton icon={Square} label="停止" disabled={!props.stop} onClick={() => props.stop?.()}/>}
          <IconButton icon={SendIcon} label={running ? '排队发送' : '发送'} disabled={empty || blocked || busy || !props.inputActions} onMouseDown={(e: React.MouseEvent) => e.preventDefault()} onClick={() => { setDismissedNotice(notice?.seq ?? 0); props.inputActions.submit() }}/>
        </div>
      </div> : controls && <BoardTools {...controls.tools()} status={status} onAI={() => dock.expand(id)}/>}
  </div>, portal)}</>
}

function ReplyToast({ reply, onClose, onOpen }: { reply: Reply; onClose: () => void; onOpen: () => void }) {
  const [hovered, setHovered] = React.useState(false), [focused, setFocused] = React.useState(false)
  const remaining = useRef(12000), close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (hovered || focused) return
    const started = Date.now(), timer = setTimeout(() => close.current(), remaining.current)
    return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - started)) }
  }, [hovered, focused])
  return <section className="nb-reply-toast" aria-label="AI 回复" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false) }}>
    <p role="status" aria-live="polite">{reply.text}</p>
    <div className="nb-reply-actions"><button type="button" onClick={onOpen}>查看对话<ArrowUpRight size={14}/></button><IconButton icon={X} label="关闭回复通知" onClick={onClose}/></div>
  </section>
}
