import { afterEach, expect, it, vi } from 'vitest'
import { rpc } from '../src/client/api'

afterEach(() => vi.unstubAllGlobals())

it('explains the old-host layout rejection without hiding the failed save', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '只允许写激活画布（spec：激活画布）' }), { status: 400 })))
  await expect(rpc('/workspace', 'writeCanvas', { canvasName: 'Main', canvas: { nodes: [] } })).rejects.toThrow('位置尚未保存：Harness 后台仍在运行旧版插件')
})

it('preserves normal layout success and version conflict failures', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, canvasVersion: 'saved' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: '内容已被修改，请重新读取后重试' }), { status: 400 }))
  vi.stubGlobal('fetch', fetch)
  await expect(rpc('/workspace', 'writeCanvas')).resolves.toMatchObject({ ok: true, canvasVersion: 'saved' })
  await expect(rpc('/workspace', 'writeCanvas')).rejects.toThrow('内容已被修改')
})
