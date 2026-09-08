import React, { useLayoutEffect, useRef, useState } from 'react'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { AlignLeft, Copy, MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import { Colors, IconButton } from '../ui'
import type { NbNode } from '../types'

export function NodeMenu({ bounds, board, nodes, noteCount, padding, onAction, onEdit, onReference }: any) {
  const ref = useRef<HTMLDivElement>(null), [panel, setPanel] = useState('')
  const textOnly = noteCount === 0, single = nodes.length === 1
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !board) return
    let active = true
    const update = () => {
      const r = board.getBoundingClientRect(), virtual = { getBoundingClientRect: () => new DOMRect(r.left + bounds.x, r.top + bounds.y, bounds.width, bounds.height) }
      void computePosition(virtual, element, { strategy: 'fixed', placement: 'top', middleware: [offset(10), flip({ boundary: board, padding }), shift({ boundary: board, padding })] }).then(({ x, y }) => { if (active) Object.assign(element.style, { left: `${x}px`, top: `${y}px`, visibility: 'visible' }) })
    }
    update(); const observer = new ResizeObserver(update); observer.observe(element); observer.observe(board)
    return () => { active = false; observer.disconnect() }
  }, [bounds, board, padding, panel])
  return <div ref={ref} className="nb-selection-tools nb-overlay" style={{ position: 'fixed', visibility: 'hidden', pointerEvents: 'auto' }} onPointerDown={(e) => e.stopPropagation()}>
    <div className="nb-tool-row">
      {textOnly && single && <><IconButton icon={Pencil} label="编辑文本" onClick={onEdit}/><IconButton icon={Copy} label="复制文本" onClick={() => onAction('duplicateText', { id: nodes[0].id })}/>
        <select aria-label="文字字号" value={nodes[0].noteboard?.fontSize ?? (nodes[0].id.startsWith('tag:') ? 14 : 20)} onChange={(e) => onAction('updateText', { id: nodes[0].id, patch: { fontSize: Number(e.target.value) } })}>{[14, 20, 28].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        <button className="nb-icon" title="文字颜色" aria-label="文字颜色" onClick={() => setPanel(panel === 'color' ? '' : 'color')}><span className={`nb-color-indicator color-${nodes[0].noteboard?.color ?? 'gray'}`}/></button></>}
      {!single && <span className="nb-selection-count">{nodes.length} 个对象</span>}
      {nodes.length > 1 && <IconButton icon={AlignLeft} label="对齐与分布" onClick={() => setPanel(panel === 'align' ? '' : 'align')}/>}
      {noteCount > 0 && <IconButton icon={MessageSquarePlus} label="引用所选便签" onClick={onReference}/>}
      <IconButton icon={Trash2} label={textOnly ? '删除文本' : '移除所选对象'} onClick={() => onAction('removeNodes', { ids: nodes.map((n: NbNode) => n.id) })}/>
    </div>
    {panel === 'color' && <div className="nb-popover-body"><Colors value={nodes[0].noteboard?.color ?? 'gray'} onChange={(color: string) => onAction('updateText', { id: nodes[0].id, patch: { color } })}/></div>}
    {panel === 'align' && <div className="nb-menu-list">{[['left','左对齐'],['centerX','水平居中'],['right','右对齐'],['top','顶端对齐'],['centerY','垂直居中'],['bottom','底端对齐'],['distributeX','水平等距'],['distributeY','垂直等距']].map(([action, label]) => <button key={action} disabled={action.startsWith('distribute') && nodes.length < 3} onClick={() => { onAction('layout', { action, ids: nodes.map((n: NbNode) => n.id) }); setPanel('') }}>{label}</button>)}</div>}
  </div>
}
