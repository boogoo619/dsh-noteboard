import { buildApi } from './commands.mjs'
import { Config, registerSettings } from './settings.mjs'
import { registerIntelligence } from './intelligence.mjs'
import { parseWorkspaceRoot } from './workspace-root.mjs'
export { buildApi } from './commands.mjs'
// dsh 0.2 reads the plugin-entry Config (same preference fields, volatile so
// Plugins-page edits apply live); the loader validates entry config against it.
export { Config } from './settings.mjs'
export const name = 'noteboard'
export const inject = ['webServer']
export function apply(ctx, config) {
  const api = buildApi()
  Object.defineProperty(api, 'llm', { get: () => ctx.get('llm') })
  api.settingsHandle = registerSettings(ctx)
  // Preference source: the live entry config on dsh 0.2 (fiber.config is
  // swapped in place by config-only updates, so read it lazily), falling back
  // to the snapshot apply() received; dsh <= 0.1 prefers the served-namespace
  // handle, which reports undefined on 0.2 (see commands.mjs).
  Object.defineProperty(api, 'config', { get: () => ctx.fiber?.config ?? config ?? {} })
  ctx.effect(() => ctx.provide('noteboard', api))
  const allowed = new Set(Object.keys(api).filter((k) => typeof api[k] === 'function'))
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/noteboard/api/rpc', async handler(req, res) {
    res.setHeader('content-type', 'application/json; charset=utf-8')
    try {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: '仅接受 POST' })); return }
      const root = new URL(req.url, 'http://localhost').searchParams.get('root')
      parseWorkspaceRoot(root)
      let raw = ''
      for await (const chunk of req) { raw += chunk; if (raw.length > 4_000_000) throw new Error('请求过大') }
      const { method, args } = JSON.parse(raw)
      if (!allowed.has(method)) throw new Error('未知操作')
      res.end(JSON.stringify(await api[method](root, args ?? {})))
    } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: String(e.message), operationId: e.operationId, completedFiles: e.completedFiles })) }
  } }))
  registerIntelligence(ctx, api)
}
