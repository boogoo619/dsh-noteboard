import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
export function IconButton({ icon: Icon, label, active, ...props }: any) {
  return <button type="button" className={`nb-icon${active ? ' is-active' : ''}`} title={label} aria-label={label} aria-pressed={active === undefined ? undefined : active} {...props}><Icon size={17} strokeWidth={1.7}/></button>
}
export function Dialog({ title, onClose, children, wide = false }: any) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    ref.current?.querySelector<HTMLElement>('input,textarea,button')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeRef.current() }
      if (e.key === 'Tab') {
        const elements = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select,[tabindex="0"]')]
        const first = elements[0], last = elements.at(-1)
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('keydown', key, true); previous?.focus() }
  }, [])
  return createPortal(<div className="nb-overlay nb-modal-mask" style={{ pointerEvents: 'auto' }} onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}>
    <div ref={ref} className={`nb-dialog${wide ? ' nb-dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header><strong>{title}</strong><IconButton icon={X} label="关闭" onClick={onClose}/></header>{children}
    </div>
  </div>, document.body)
}
export const COLOR_NAMES: Record<string, string> = { yellow: '黄色', pink: '粉色', blue: '蓝色', green: '绿色', orange: '橙色', purple: '紫色', gray: '灰色' }
export function Colors({ value, onChange }: any) {
  return <div className="nb-colors" role="group" aria-label="便签颜色">{Object.keys(COLOR_NAMES).map((color) => <button key={color} type="button" className={`nb-swatch color-${color}`} title={COLOR_NAMES[color]} aria-label={COLOR_NAMES[color]} aria-pressed={value === color} onClick={() => onChange(color)}>{value === color ? <span/> : null}</button>)}</div>
}
