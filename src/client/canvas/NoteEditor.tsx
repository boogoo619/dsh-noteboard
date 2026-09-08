import React, { useState, useCallback } from 'react'
import { Save, X } from 'lucide-react'
import { rpc } from '../api'
import { renderMarkdown } from '../markdown'
import { Dialog, Colors, IconButton } from '../ui'
export function NoteEditor({ note, cwd, canvasName, position, defaultColor = 'yellow', onDone, onClose }: any) {
  const [initialColor] = useState(note?.color ?? defaultColor)
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [color, setColor] = useState(initialColor)
  const [tags, setTags] = useState<string[]>(note?.tags ?? [])
  const [tag, setTag] = useState(''), [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false), [error, setError] = useState('')
  const dirty = title !== (note?.title ?? '') || body !== (note?.body ?? '') || color !== initialColor || JSON.stringify(tags) !== JSON.stringify(note?.tags ?? [])
  const close = useCallback(() => { if (!saving && (!dirty || window.confirm('放弃未保存的修改？'))) onClose() }, [saving, dirty, onClose])
  async function save() {
    if (saving) return
    setSaving(true); setError('')
    try {
      const result = await rpc(cwd, note ? 'updateNotes' : 'createNote', note
        ? { ids: [note.id], versions: { [note.id]: note.version }, patch: { title: title || '未命名', body, color, tags } }
        : { title: title || '未命名', body, color, tags, canvasName, ...position })
      onDone(result)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }
  return <Dialog title={note ? '编辑便签' : '新建便签'} onClose={close} wide>
    <div className="nb-editor" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void save() } }}>
      <input className="nb-title-input" aria-label="标题" placeholder="未命名" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)}/>
      <div className="nb-editor-meta"><Colors value={color} onChange={setColor}/><span className="nb-rule"/>
        {tags.map((t) => <button className="nb-tag" key={t} onClick={() => setTags(tags.filter((v) => v !== t))}>{t}<X size={11}/></button>)}
        <input className="nb-tag-input" aria-label="新增标签" placeholder="添加标签" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => {
          if (e.key === 'Enter' && tag.trim()) { e.preventDefault(); setTags([...new Set([...tags, tag.trim()])]); setTag('') }
        }}/></div>
      <div className="nb-tabs"><button aria-selected={!preview} onClick={() => setPreview(false)}>编辑</button><button aria-selected={preview} onClick={() => setPreview(true)}>预览</button></div>
      {preview ? <div className="nb-prose nb-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(body, { full: true }) }}/> : <textarea aria-label="正文" className="nb-body-input" placeholder="记录你的想法…" value={body} onChange={(e) => setBody(e.target.value)}/>}
      {error && <p className="nb-error" role="alert">{error}</p>}
      <footer><span className="nb-muted">{body.length} 字</span><button className="nb-button" disabled={saving} onClick={close}>取消</button><button className="nb-button nb-primary" disabled={saving} onClick={save}><Save size={15}/>{saving ? '保存中…' : '保存'}</button></footer>
    </div>
  </Dialog>
}
