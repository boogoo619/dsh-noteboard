import React, { useState } from 'react'
import { Eye, RotateCcw } from 'lucide-react'
import { rpc } from './api'
import { Dialog, IconButton } from './ui'

const toolNames = ['canvas_add_note', 'noteboard_query', 'noteboard_create', 'noteboard_update', 'noteboard_add', 'noteboard_remove', 'noteboard_layout', 'noteboard_save_as', 'noteboard_history', 'noteboard_restore']
export function registerToolResults(ctx: any) {
  ctx.effect(() => ctx.slots.inject('tool.call.toolview', () => {
    const cleanups = toolNames.map((key) => ctx.slots.register({ name: 'tool.call.toolview', key }, ToolResult))
    return () => cleanups.forEach((dispose: any) => dispose?.())
  }))
}
function ToolResult({ block, cwd, toolName }: any) {
  const [entry, setEntry] = useState<any>(null)
  const [error, setError] = useState('')
  const [restored, setRestored] = useState(false)
  const [busy, setBusy] = useState(false)
  const settled = 'kind' in block
  let result: any = {}
  try { result = JSON.parse((block.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')) } catch {}
  const inspect = async () => {
    setBusy(true); setError('')
    try { setEntry(result.operationId && cwd ? await rpc(cwd, 'history', { id: result.operationId }) : { files: [], result }) }
    catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const restore = async () => {
    setBusy(true); setError('')
    try { await rpc(cwd, 'restoreOperation', { id: result.operationId }); setRestored(true); setEntry(null) }
    catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  return <div className="nb-overlay" style={{ position: 'relative', pointerEvents: 'auto', color: 'var(--nb-text)', padding: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><strong>{toolName}</strong><span>{!settled ? '执行中…' : restored ? '已恢复' : block.isError ? '操作失败' : result.succeeded ? `已完成 ${result.succeeded.length} 项` : '已完成'}</span>
      {settled && <IconButton icon={Eye} label="查看结果与差异" disabled={busy} onClick={inspect}/>}</div>
    {error && <p role="alert">{error}</p>}
    {entry && <Dialog title="操作结果" onClose={() => setEntry(null)} wide>
      <div style={{ overflow: 'auto', padding: 16, maxHeight: '65vh' }}>
        {(entry.files ?? []).map((file: any) => <section key={file.path}><strong>{file.path}</strong><details><summary>修改前</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{file.before ?? '文件不存在'}</pre></details><details open><summary>修改后</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{file.after ?? '文件不存在'}</pre></details></section>)}
        {!entry.files?.length && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(entry.result ?? result, null, 2)}</pre>}
        {result.operationId && cwd && !restored && <button className="nb-button" disabled={busy} onClick={restore}><RotateCcw size={16}/>恢复此操作</button>}
        {error && <p role="alert">{error}</p>}
      </div>
    </Dialog>}
  </div>
}
