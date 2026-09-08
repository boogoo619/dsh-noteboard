import React, { useLayoutEffect, useRef, useState } from 'react'
import { nodeText } from '../../nodes.mjs'
import type { NbNode } from '../types'

export function textHeight(text: string, width: number, fontSize: number, parent: HTMLElement | null) {
  if (!parent) return fontSize * 1.5
  const element = document.createElement('div')
  element.className = 'nb-text-content'
  Object.assign(element.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: `${width}px`, fontSize: `${fontSize}px`, height: 'auto' })
  element.textContent = `${text}\n`
  parent.append(element)
  const height = Math.max(fontSize * 1.5, element.scrollHeight)
  element.remove()
  return height
}

export function TextEditor({ node, onSave, onCancel }: { node: NbNode; onSave: (text: string, height: number) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(nodeText(node)), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null), settled = useRef(false), inFlight = useRef(false)
  const fontSize = node.noteboard?.fontSize ?? (node.id.startsWith('tag:') ? 14 : 20)
  useLayoutEffect(() => { field.current?.focus(); field.current?.setSelectionRange(text.length, text.length) }, [])
  useLayoutEffect(() => {
    const element = field.current
    if (element) { element.style.height = '0px'; element.style.height = `${Math.max(fontSize * 1.5, element.scrollHeight)}px` }
  }, [text, fontSize])
  async function save() {
    if (settled.current || inFlight.current) return
    inFlight.current = true; setSaving(true); setError('')
    try { await onSave(text, Math.max(fontSize * 1.5, field.current?.scrollHeight ?? 30)); settled.current = true }
    catch (e: any) { setError(e.message); field.current?.focus() }
    finally { inFlight.current = false; setSaving(false) }
  }
  return <div className={`nb-text-editor color-${node.noteboard?.color ?? 'gray'}`} style={{ left: node.x, top: node.y, width: node.width, fontSize }} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
    <textarea ref={field} aria-label="画布文本" value={text} maxLength={32000} readOnly={saving} onChange={(e) => setText(e.target.value)} onBlur={() => void save()} onKeyDown={(e) => {
      e.stopPropagation()
      if (e.nativeEvent.isComposing) return
      if (e.key === 'Escape') { e.preventDefault(); settled.current = true; onCancel() }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save() }
    }}/>
    {error && <div className="nb-text-error" role="alert">{error}<button onMouseDown={(e) => e.preventDefault()} onClick={() => void save()}>重试</button></div>}
  </div>
}
