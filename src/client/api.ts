/**
 * The single `/noteboard/api/*` JSON seam (triathlon-style). Every browser
 * call that reads/writes host routes goes through `rpc()`; the workspace root
 * rides the query string.
 */

export function rpc(root: string, method: string, args: any = {}) {
  const url = `/noteboard/api/rpc?root=${encodeURIComponent(root)}`
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, args: args ?? {} }),
  })
    .then(async (r) => {
      const body = await r.json().catch(() => ({}))
      if (!r.ok || (body && body.error)) {
        if (body?.error === '只允许写激活画布（spec：激活画布）') {
          throw new Error('便签位置尚未保存：Harness 后台仍在运行旧版插件。请重启当前 dsh web 后重试保存；仅刷新网页不会更新后台。')
        }
        const detail = body.operationId ? `；部分操作可能已保存，可在操作记录中查看或恢复（${body.operationId}）` : ''
        throw Object.assign(new Error((body?.error ?? `noteboard rpc ${method} failed (${r.status})`) + detail), { operationId: body.operationId, completedFiles: body.completedFiles })
      }
      return body
    })
}

/** Focus request: center the canvas on one note and pulse it. */
export function focusNote(id: string) {
  window.dispatchEvent(new CustomEvent('noteboard:focus-note', { detail: { id } }))
}
