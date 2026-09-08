import React, { useLayoutEffect, useRef, useState } from 'react'
import { computePosition, flip, shift, offset } from '@floating-ui/dom'
import { Pencil, Tags, Link, MessageSquarePlus, MoreHorizontal, Unlink, AlignLeft, X } from 'lucide-react'
import { Colors, IconButton } from '../ui'

export function CardMenu({ bounds, board, padding = { top: 76, left: 12, right: 12, bottom: 54 }, notes, onAction, onEdit, onSource, onReference, onClose }: any) {
  const ref = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState(''), [tag, setTag] = useState('')
  const colors = new Set(notes.map((n: any) => n.color))
  const tags = [...new Set<string>(notes.flatMap((n: any) => n.tags))]
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !board) return
    let active = true
    const update = () => {
      const r = board.getBoundingClientRect()
      const virtual = { getBoundingClientRect: () => new DOMRect(r.left + bounds.x, r.top + bounds.y, bounds.width, bounds.height), contextElement: board }
      void computePosition(virtual, el, { strategy: 'fixed', placement: 'top', middleware: [offset(10), flip({ boundary: board, padding }), shift({ boundary: board, padding })] }).then(({ x, y }) => {
        if (active) Object.assign(el.style, { left: `${x}px`, top: `${y}px`, visibility: 'visible' })
      })
    }
    update(); const observer = new ResizeObserver(update); observer.observe(el); observer.observe(board)
    return () => { active = false; observer.disconnect() }
  }, [bounds, board, panel, padding])
  const toggle = (name: string) => setPanel(panel === name ? '' : name)
  return <div ref={ref} className="nb-selection-tools" style={{ position: 'fixed', visibility: 'hidden' }} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); panel ? setPanel('') : onClose() } }}>
    <div className="nb-tool-row">
      {notes.length > 1 ? <span className="nb-selection-count">{notes.length} 张</span> : <IconButton icon={Pencil} label="编辑便签" onClick={onEdit}/>}
      <button className="nb-icon" aria-label="换色" title={colors.size > 1 ? '混合颜色' : '换色'} onClick={() => toggle('color')}><span className={`nb-color-indicator ${colors.size === 1 ? `color-${notes[0].color}` : 'nb-mixed'}`}/></button>
      <IconButton icon={Tags} label="编辑标签" active={panel === 'tags'} onClick={() => toggle('tags')}/>
      {notes.length === 1 && <IconButton icon={Link} label="查看原文与依据" onClick={onSource}/>}
      <span className="nb-rule"/><IconButton icon={MessageSquarePlus} label="加入对话" onClick={onReference}/>
      {notes.length > 1 && <IconButton icon={AlignLeft} label="对齐与分布" active={panel === 'align'} onClick={() => toggle('align')}/>}
      <IconButton icon={MoreHorizontal} label="更多操作" active={panel === 'more'} onClick={() => toggle('more')}/>
    </div>
    {panel === 'color' && <div className="nb-popover-body"><Colors value={colors.size === 1 ? notes[0].color : null} onChange={(color: string) => onAction('updateNotes', { patch: { color } })}/></div>}
    {panel === 'tags' && <div className="nb-popover-body nb-tag-panel">{tags.map((t) => {
      const count = notes.filter((n: any) => n.tags.includes(t)).length
      return <div className="nb-tag-option" key={t}><button onClick={() => onAction('updateNotes', { patch: { addTags: [t] } })}>{t}<span className="nb-muted">{count}/{notes.length}</span></button><IconButton icon={X} label={`移除标签 ${t}`} onClick={() => onAction('updateNotes', { patch: { removeTags: [t] } })}/></div>
    })}<form onSubmit={(e) => { e.preventDefault(); if (tag.trim()) { onAction('updateNotes', { patch: { addTags: [tag.trim()] } }); setTag('') } }}><input autoFocus placeholder="添加标签" aria-label="新增标签" value={tag} onChange={(e) => setTag(e.target.value)}/><button className="nb-button">添加</button></form></div>}
    {panel === 'align' && <div className="nb-menu-list">{[['left','左对齐'],['centerX','水平居中'],['right','右对齐'],['top','顶端对齐'],['centerY','垂直居中'],['bottom','底端对齐'],['distributeX','水平等距'],['distributeY','垂直等距']].map(([action, label]) => <button key={action} disabled={action.startsWith('distribute') && notes.length < 3} onClick={() => { onAction('layout', { action }); setPanel('') }}>{label}</button>)}</div>}
    {panel === 'more' && <div className="nb-menu-list"><button className="nb-danger" onClick={() => onAction('removeNotes', {})}><Unlink size={15}/>从此画布移除</button></div>}
  </div>
}
