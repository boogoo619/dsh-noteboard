import { chromium, expect } from '@playwright/test'
import { mkdtemp, readFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApi } from '../src/commands.mjs'

const origin = process.env.NOTEBOARD_TEST_URL ?? 'http://127.0.0.1:3083'
const root = await mkdtemp(join(tmpdir(), 'noteboard-compact-')), api = buildApi()
await api.state(root)
await api.createNotes(root, { notes: Array.from({ length: 8 }, (_, i) => ({ title: ['发布方案', '设计原则', '用户访谈'][i] ?? `引用便签 ${i} 的完整长标题与内容说明`, body: `第 ${i} 张便签的预览正文`, color: ['yellow', 'blue', 'pink', 'green'][i % 4], x: (i % 4) * 300, y: Math.floor(i / 4) * 220 })) })
const notes = (await api.state(root)).notes
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = [], submissions = [], queries = []
const artifacts = join(process.cwd(), 'artifacts', 'compact'); await mkdir(artifacts, { recursive: true })
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.text().includes('subscriber failed')) errors.push(message.text()) })
await page.route('**/plugins/**', async (route) => {
  if (!route.request().url().includes('dsh-noteboard')) return route.continue()
  const response = await route.fetch(), body = await response.text(), marker = 'const composer = createComposer(ctx, integration);'
  if (!body.includes(marker)) throw new Error('Missing compact test injection target')
  await route.fulfill({ response, body: body.replace(marker, `${marker} window.__nbCompact = { ctx, integration, composer };`) })
})
await page.route('**/noteboard/api/rpc?*', async (route) => {
  const { method, args } = route.request().postDataJSON()
  if (method === 'query') queries.push(args)
  try { await route.fulfill({ json: await api[method](root, args) }) }
  catch (e) { await route.fulfill({ status: 400, json: { error: e.message } }) }
})
await page.route('**/api/session/prompt', async (route) => {
  const request = route.request().postDataJSON(); submissions.push(request.payload)
  await route.fulfill({ json: { type: 'server-response', rpcId: request.rpcId, result: { ok: true, value: { accepted: true } } } })
})
const editor = page.locator('[data-composer-input]'), card = page.locator('[data-composer-card]'), toast = page.locator('.nb-reply-toast')
const add = (selected) => page.evaluate(async ({ root, selected }) => { const { ctx, integration, composer } = window.__nbCompact, id = ctx.sessions.list.getSnapshot().current; await integration.addReferences(id, root, 'Main', selected); composer.expand(id) }, { root, selected })
const screenshot = (name) => page.screenshot({ path: join(artifacts, `${name}.png`) })
async function assistantTurn(turn, text, reason = 'completed', finish = true) {
  await page.evaluate(({ turn, text, reason, finish }) => {
    const { ctx } = window.__nbCompact, source = ctx.sessions.binding(ctx.sessions.list.getSnapshot().current).eventSource
    let seq = Math.max(...source.getSnapshot().entries.map((entry) => entry.event.seq)) + 1
    const append = (type, data) => {
      source.append({ type: 'event', event: { type, data, seq: seq++, time: Date.now(), ...(type === 'assistant/message' ? { surfaceOp: 'append' } : {}) } })
    }
    append('turn/start', { turn }); append('step/start', { turn, step: 0 })
    append('assistant/message', { turn, step: 0, message: { role: 'assistant', source: { provider: 'test', model: 'test' }, content: [{ type: 'text', text }] } })
    append('step/end', { turn, step: 0 })
    if (finish) append('turn/end', { turn, reason: { kind: reason } })
    window.__nbFinish = () => append('turn/end', { turn, reason: { kind: reason } })
  }, { turn, text, reason, finish })
}
try {
  const log = await readFile(`/tmp/noteboard-dsh-${new URL(origin).port}.log`, 'utf8')
  await page.goto(log.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/)?.[0] ?? origin)
  await page.getByRole('button', { name: '完成', exact: true }).click({ timeout: 1500 }).catch(() => {})
  await page.getByText('添加缩放画布查看所有便签按钮', { exact: true }).first().click()
  await page.getByRole('tab', { name: '画布', exact: true }).click()
  await expect(page.locator('.nb-board-tools')).toBeVisible()
  expect((await page.locator('.nb-board-tools').boundingBox()).width).toBeLessThan(250)
  await screenshot('toolbar')
  await page.getByRole('button', { name: 'AI 助手', exact: true }).click()
  await expect.poll(async () => (await card.boundingBox()).height).toBe(48)
  await expect(page.getByRole('button', { name: '查看对话', exact: true })).toHaveCount(0)
  await editor.fill('整理这些便签')
  await expect.poll(async () => (await card.boundingBox()).height).toBe(48)
  await screenshot('single-line')
  await editor.fill('一\n二\n三\n四\n五\n六\n七\n八')
  await expect.poll(async () => (await card.boundingBox()).height).toBe(158)
  expect(await page.locator('[data-input-scroll]').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
  await editor.fill('请比较这些便签。')
  await expect.poll(async () => (await card.boundingBox()).height).toBe(48)
  await add(notes.slice(0, 3))
  await expect(page.locator('.nb-reference-chip')).toHaveCount(3)
  const first = notes[0], second = notes[1]
  await expect(page.locator(`[data-reference-id="${first.id}"]`)).toHaveClass(new RegExp(`color-${first.color}`))
  const railBox = await page.locator('.nb-reference-rail').boundingBox(), cardBox = await card.boundingBox()
  expect(railBox.y + railBox.height).toBeLessThanOrEqual(cardBox.y - 7)
  await page.getByRole('button', { name: `预览引用：${first.title}`, exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(first.body)
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(editor).toBeFocused()
  await page.getByRole('button', { name: `移除引用：${first.title}`, exact: true }).click()
  await expect(page.locator('.nb-reference-chip')).toHaveCount(2)
  await expect(editor).toContainText('请比较这些便签。')
  const remaining = await page.evaluate(() => { const { ctx } = window.__nbCompact; return ctx.get('conversation').input.for(ctx.sessions.scope(ctx.sessions.list.getSnapshot().current)).state.getSnapshot().occurrences.map((o) => JSON.parse(o.ref).ids).flat() })
  expect(remaining).not.toContain(first.id); expect(remaining).toContain(second.id)
  expect((await api.state(root)).notes).toHaveLength(8)
  await editor.press('Meta+z')
  await expect(page.locator('.nb-reference-chip')).toHaveCount(3)
  await add(notes)
  await expect(page.locator('.nb-reference-chip')).toHaveCount(8)
  await expect(page.getByRole('button', { name: '向左滚动引用', exact: true })).toBeVisible()
  const beforeTyping = queries.length
  await editor.press('End'); await editor.pressSequentially('追加说明')
  await page.waitForTimeout(100)
  expect(queries.length).toBe(beforeTyping)

  // Exercise the real host event assembler in this page only, without server writes.
  await assistantTurn(1000, '这是中间步骤的文字', 'completed', false)
  await expect(toast).toHaveCount(0)
  await page.evaluate(() => window.__nbFinish())
  await expect(toast).toContainText('这是中间步骤的文字')
  expect((await toast.boundingBox()).y + (await toast.boundingBox()).height).toBeLessThan(railBox.y)
  await page.getByRole('button', { name: '关闭回复通知', exact: true }).click()
  await assistantTurn(1001, '这是一段被取消的回复', 'aborted')
  await expect(toast).toHaveCount(0)
  await assistantTurn(1002, '已按主题整理便签，并保留每条材料的原始观点。\n第二段结果。\n第三段结果。\n更多内容在对话中。')
  await expect(toast).toBeVisible()
  await page.clock.install()
  await toast.hover(); await page.clock.runFor(13000)
  await expect(toast).toBeVisible()
  await page.mouse.move(350, 120); await page.clock.runFor(12001)
  await expect(toast).toHaveCount(0)
  await assistantTurn(1003, '已完成整理，可继续补充指令。')
  await expect(toast).toBeVisible()
  await toast.getByRole('button', { name: '查看对话', exact: false }).click()
  await expect(page.getByRole('tab', { name: '对话', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: '画布', exact: true }).click()
  await expect(toast).toHaveCount(0)

  for (const width of [1440, 1024, 720, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const dark of [false, true]) {
      await page.evaluate((dark) => document.body.toggleAttribute('data-ds-dark-theme', dark), dark)
      await assistantTurn(1100 + width + Number(dark), '已更新便签分类，并保留原始内容。你可以继续补充整理要求。')
      await expect(toast).toBeVisible()
      const board = await page.locator('.nb-board').boundingBox(), box = await card.boundingBox()
      expect(box.width).toBeLessThanOrEqual(Math.min(560, board.width - 32) + 1)
      expect(box.x).toBeGreaterThanOrEqual(board.x + 15)
      const chips = await page.locator('.nb-reference-chip').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().y))
      expect(new Set(chips).size).toBe(1)
      const inputBox = await editor.boundingBox(), sendBox = await page.getByRole('button', { name: '发送', exact: true }).boundingBox()
      expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(sendBox.x)
      await screenshot(`${width}-${dark ? 'dark' : 'light'}`)
      await page.getByRole('button', { name: '关闭回复通知', exact: true }).click()
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: '收起输入，返回画布工具', exact: true }).click()
  await expect(page.locator('.nb-reference-dock')).toBeHidden()
  await assistantTurn(4000, '工具栏收起时也能收到回复。')
  await expect(toast).toBeVisible()
  await screenshot('toolbar-reply')
  await page.getByRole('button', { name: 'AI 助手', exact: true }).click()
  await expect(page.locator('.nb-reference-chip')).toHaveCount(8)
  await page.getByRole('button', { name: '关闭回复通知', exact: true }).click()
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect.poll(() => submissions.length).toBe(1)
  await expect(page.locator('.nb-reference-chip')).toHaveCount(0)
  await expect(editor).toHaveText('')
  expect(JSON.stringify(submissions[0])).toContain('noteboard-reference')
  const insertRaw = (selected) => page.evaluate(({ root, selected }) => {
    const { ctx } = window.__nbCompact, facade = ctx.get('conversation').input.for(ctx.sessions.scope(ctx.sessions.list.getSnapshot().current))
    const state = facade.state.getSnapshot(), end = state.draft.length - state.occurrences.reduce((n, o) => n + o.length - 1, 0)
    const ref = JSON.stringify({ root, canvasName: 'Main', ids: selected.map((n) => n.id), titles: selected.map((n) => n.title) })
    return facade.insertReference({ source: 'noteboard', ref, label: selected[0].title, appearance: 'file', clipboardText: `@便签(${selected.map((n) => n.title).join('、')})` }, { start: end, end, draftRev: state.draftRev })
  }, { root, selected })
  await insertRaw([first]); await expect(editor.locator('[data-composer-chip]')).toHaveCount(1)
  await insertRaw([first]); await expect(editor.locator('[data-composer-chip]')).toHaveCount(2)
  await expect(page.locator('.nb-reference-chip')).toHaveCount(1)
  await page.getByRole('button', { name: `移除引用：${first.title}`, exact: true }).click()
  await expect(editor.locator('[data-composer-chip]')).toHaveCount(0)
  await expect(page.locator('.nb-reference-chip')).toHaveCount(0)
  await insertRaw([{ id: 'missing-reference', title: '已失效的便签' }])
  await expect(page.locator('.nb-reference-name')).toHaveAttribute('title', /便签已不存在/)
  await expect(page.locator('.nb-reference-chip')).toHaveClass(/color-gray/)
  await page.getByRole('button', { name: '预览引用：已失效的便签', exact: true }).click()
  await expect(page.locator('.nb-reference-error')).toContainText('便签已不存在')
  await page.getByRole('button', { name: '移除引用：已失效的便签', exact: true }).click()
  await expect(page.locator('.nb-reference-dock')).toHaveCount(0)
  await add([first])
  await expect(page.locator('.nb-reference-chip')).toHaveCount(1)
  await editor.fill('正文删除引用后保留这段文字')
  await expect(page.locator('.nb-reference-chip')).toHaveCount(0)
  await expect.poll(async () => (await card.boundingBox()).height).toBe(48)
  await editor.fill('')
  expect(errors).toEqual([])
  console.log('PASS: compact layout, colored references, preview/focus, partial removal/undo, scrolling, real host turn notifications, expiry, navigation and responsive screenshots')
} catch (error) {
  console.error('REPLY STATE', await page.evaluate(() => { const { ctx } = window.__nbCompact; const id = ctx.sessions.list.getSnapshot().current; const s = ctx.get('uiConversation').binding(id).target('chat').getSnapshot(); return JSON.stringify({ events: ctx.sessions.binding(id).eventSource.getSnapshot().entries.slice(-6), turns: [...(s?.timeline.turns.values() ?? [])].slice(-1).map((t) => ({ ...t, tail: t.data.get('turn-tail'), steps: t.steps.map((step) => step.data.get('assistant-step')) })) }) }).catch((e) => e.message))
  await screenshot('failure'); console.error('PAGE ERRORS', errors); throw error
} finally { await browser.close(); await rm(root, { recursive: true, force: true }) }
