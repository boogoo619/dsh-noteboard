import { chromium, expect } from '@playwright/test'
import { mkdtemp, readFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApi } from '../src/commands.mjs'
import { nodeKind } from '../src/nodes.mjs'

const origin = process.env.NOTEBOARD_TEST_URL ?? 'http://127.0.0.1:3082'
const port = new URL(origin).port
const root = await mkdtemp(join(tmpdir(), 'noteboard-upgrade-')), api = buildApi()
await api.state(root)
await api.createNotes(root, { notes: [
  { title: '发布方案', body: '邀请核心用户试用，收集反馈后发布。', tags: ['产品'], color: 'yellow', x: 0, y: 0 },
  { title: '设计原则', body: '内容优先，保持稳定的布局。', tags: ['设计'], color: 'blue', x: 300, y: 0 },
  { title: '用户访谈', body: '记录原始材料，验证真实需求。', tags: ['产品'], color: 'pink', x: 0, y: 220 },
] })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const storage = JSON.parse(await readFile('/tmp/noteboard-browser-state.json', 'utf8'))
storage.origins = storage.origins.map((item) => ({ ...item, origin }))
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: storage })
const page = await context.newPage(), errors = []
// Instrument only the response delivered to this isolated test page.
await page.route('**/plugins/**', async (route) => {
  if (!route.request().url().includes('dsh-noteboard')) return route.continue()
  const response = await route.fetch(), body = await response.text()
  const marker = 'const integration = createIntegration(ctx);'
  if (!body.includes(marker)) throw new Error('Noteboard test instrumentation target missing')
  await route.fulfill({ response, body: body.replace(marker, `window.__nbTestContext = ctx; window.__nbTestReact = react; ${marker}`) })
})
page.on('pageerror', (error) => errors.push(error.message))
let failText = false
let failSend = true, cancellations = 0
const submissions = []
await page.route('**/api/session/prompt', async (route) => {
  const request = route.request().postDataJSON(); submissions.push(request.payload)
  await route.fulfill({ json: { type: 'server-response', rpcId: request.rpcId, result: failSend ? { ok: false, error: { code: 'gateway/internal', message: '测试：发送失败', details: {} } } : { ok: true, value: { accepted: true } } } })
})
await page.route('**/api/session/cancel', async (route) => {
  cancellations++
  const request = route.request().postDataJSON()
  await route.fulfill({ json: { type: 'server-response', rpcId: request.rpcId, result: { ok: true, value: { cancelled: true } } } })
  await page.evaluate(() => { const ctx = window.__nbTestContext; ctx.sessions.binding(ctx.sessions.list.getSnapshot().current).session.handleRunning(false) })
})
await page.route('**/noteboard/api/rpc?*', async (route) => {
  const { method, args } = route.request().postDataJSON()
  if (failText && method === 'updateText') { failText = false; await route.fulfill({ status: 400, json: { error: '测试：文本保存失败' } }); return }
  try { await route.fulfill({ json: await api[method](root, args) }) }
  catch (e) { await route.fulfill({ status: 400, json: { error: e.message } }) }
})
const artifacts = join(process.cwd(), 'artifacts', 'upgrade'); await mkdir(artifacts, { recursive: true })
const editor = page.locator('[data-composer-input]')
const screenshot = (name) => page.screenshot({ path: join(artifacts, `${name}.png`) })
try {
  const log = await readFile(`/tmp/noteboard-dsh-${port}.log`, 'utf8').catch(() => '')
  const tokenURL = log.match(new RegExp(`http://127\\.0\\.0\\.1:${port}/\\?token=\\S+`))?.[0]
  await page.goto(tokenURL ?? origin)
  await page.getByRole('button', { name: '完成', exact: true }).click({ timeout: 1500 }).catch(() => {})
  await page.getByText('添加缩放画布查看所有便签按钮', { exact: true }).first().click()
  await page.getByText('画布', { exact: true }).first().click()
  expect(await page.evaluate(() => Boolean(window.__nbTestContext))).toBe(true)
  await expect(page.locator('.nb-composer-custom')).toBeVisible()
  await expect(page.locator('.nb-card')).toHaveCount(3)
  await expect(editor).toBeHidden()
  const initial = await page.locator('.nb-board').boundingBox()
  await page.getByRole('button', { name: '全览', exact: true }).click()
  await screenshot('desktop-tools-light')
  await page.getByRole('button', { name: 'AI 助手', exact: false }).click()
  await expect(editor).toBeVisible()
  await expect(page.getByRole('button', { name: '新建文本', exact: true })).toBeHidden()
  await expect.poll(async () => Math.round((await page.locator('[data-composer-seat]').boundingBox()).width)).toBe(560)
  expect(await page.locator('.nb-board').boundingBox()).toEqual(initial)
  await editor.fill('请根据这些便签整理发布安排。\n保留不同观点。')
  await screenshot('desktop-input-light')
  await page.getByRole('button', { name: '收起输入，返回画布工具', exact: true }).click()
  await expect(editor).toBeHidden()
  await expect(page.getByRole('button', { name: 'AI 助手', exact: true })).toHaveAttribute('title', /有草稿/)
  await page.getByRole('button', { name: 'AI 助手', exact: false }).click()
  await expect(editor).toContainText('保留不同观点')
  await page.getByRole('button', { name: '收起输入，返回画布工具', exact: true }).click()

  await page.locator('.nb-card').filter({ hasText: '发布方案' }).click()
  await page.getByRole('button', { name: '加入对话', exact: true }).click()
  await expect(editor).toBeVisible()
  await expect(page.getByRole('button', { name: '预览引用：发布方案', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '预览引用：发布方案', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('邀请核心用户')
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByText('对话', { exact: true }).first().click()
  await expect(page.locator('.nb-host-seat')).toHaveCount(0)
  await expect(editor).toContainText('保留不同观点')
  await expect(editor.locator('[data-composer-chip]')).toHaveCount(1)
  await page.getByText('画布', { exact: true }).first().click()
  await expect(editor).toBeVisible()
  await page.getByRole('button', { name: '收起输入，返回画布工具', exact: true }).click()

  await page.getByRole('button', { name: '平移', exact: true }).click()
  await expect(page.locator('.nb-board')).toHaveClass(/nb-pan-mode/)
  await page.getByRole('button', { name: 'AI 助手', exact: false }).click()
  await expect(page.locator('.nb-board')).not.toHaveClass(/nb-pan-mode/)
  await page.getByText('对话', { exact: true }).first().click()
  await page.getByText('画布', { exact: true }).first().click()
  await page.getByRole('button', { name: '收起输入，返回画布工具', exact: true }).click()
  await expect(page.locator('.nb-board')).toHaveClass(/nb-pan-mode/)
  expect(await page.locator('.nb-host [data-width-handle]').evaluateAll((handles) => handles.length > 0 && handles.every((handle) => getComputedStyle(handle).display === 'none' || getComputedStyle(handle).pointerEvents === 'none'))).toBe(true)
  await page.getByRole('button', { name: '选择', exact: true }).click()

  await page.getByRole('button', { name: '新建文本', exact: true }).click()
  let area = await page.locator('.nb-board').boundingBox()
  await page.mouse.click(area.x + area.width * .6, area.y + area.height * .55)
  const textField = page.getByRole('textbox', { name: '画布文本', exact: true })
  await textField.fill('阶段一\n访谈与整理')
  await textField.press('Control+Enter')
  await expect(page.locator('.nb-text')).toHaveCount(1)
  await expect(page.locator('.nb-text')).toContainText('访谈与整理')
  await page.getByRole('button', { name: '复制文本', exact: true }).click()
  await expect(page.locator('.nb-text')).toHaveCount(2)
  await page.getByRole('button', { name: '删除文本', exact: true }).click()
  await expect(page.locator('.nb-text')).toHaveCount(1)
  await page.locator('.nb-text').dblclick()
  failText = true
  await textField.fill('失败后保留的文本')
  await textField.press('Control+Enter')
  await expect(textField).toHaveValue('失败后保留的文本')
  await expect(page.locator('.nb-text-error')).toBeVisible()
  await page.locator('.nb-text-error button').click()
  await expect(textField).toHaveCount(0)
  await expect(page.locator('.nb-text')).toContainText('失败后保留的文本')

  await page.getByRole('button', { name: '画布菜单', exact: true }).click()
  await page.getByRole('button', { name: '按标签重排', exact: true }).click()
  await expect(page.locator('.nb-text')).toHaveCount(3)
  await page.getByRole('button', { name: '全览', exact: true }).click()
  const title = page.locator('.nb-text').filter({ hasText: /^产品$/ })
  await title.dblclick()
  await textField.fill('重点产品')
  await textField.press('Control+Enter')
  await expect(page.locator('.nb-text').filter({ hasText: '重点产品' })).toBeVisible()
  await page.getByRole('button', { name: '画布菜单', exact: true }).click()
  await page.getByRole('button', { name: '按标签重排', exact: true }).click()
  await expect(page.locator('.nb-text')).toHaveCount(3)
  expect((await api.state(root)).canvas.noteboard.suppressedTagHeadings).toContain('产品')
  expect((await api.state(root)).canvas.nodes.filter((n) => nodeKind(n) === 'heading')).toHaveLength(1)

  for (const width of [1440, 1024, 720, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const dark of [false, true]) {
      await page.evaluate((value) => document.body.toggleAttribute('data-ds-dark-theme', value), dark)
      await page.getByRole('button', { name: '全览', exact: true }).click()
      await screenshot(`${width}-tools-${dark ? 'dark' : 'light'}`)
      await page.getByRole('button', { name: 'AI 助手', exact: false }).click()
      await expect(editor).toBeVisible()
      await page.waitForTimeout(200)
      const seat = await page.locator('[data-composer-seat]').boundingBox(), board = await page.locator('.nb-board').boundingBox()
      expect(seat.width).toBeLessThanOrEqual(Math.min(560, board.width - 32) + 1)
      expect(seat.x).toBeGreaterThanOrEqual(board.x)
      expect(seat.x + seat.width).toBeLessThanOrEqual(board.x + board.width + 1)
      expect(seat.height).toBeLessThanOrEqual(Math.min(420, board.height * .6) + 2)
      await screenshot(`${width}-input-${dark ? 'dark' : 'light'}`)
      await page.getByRole('button', { name: '收起输入，返回画布工具', exact: true }).click()
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'AI 助手', exact: false }).click()
  await editor.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true, bubbles: true })
  expect(submissions).toHaveLength(0)
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect.poll(() => submissions.length).toBe(1)
  await expect(editor).toContainText('保留不同观点')
  await expect(editor.locator('[data-composer-chip]')).toHaveCount(1)
  await expect(page.locator('.nb-input-status')).toContainText('发送失败')
  const payload = JSON.stringify(submissions[0])
  expect(payload).toContain('邀请核心用户试用')
  expect(payload).toContain('noteboard-reference')
  failSend = false
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect.poll(() => submissions.length).toBe(2)
  await expect(editor).toHaveText('')
  await expect(page.locator('[data-nb-composer-mode=input]')).toBeVisible()
  await page.evaluate(() => { const ctx = window.__nbTestContext; ctx.sessions.binding(ctx.sessions.list.getSnapshot().current).session.handleRunning(true) })
  await editor.fill('运行中的后续指令')
  await page.getByRole('button', { name: '排队发送', exact: true }).click()
  await expect.poll(() => submissions.length).toBe(3)
  expect(JSON.stringify(submissions[2])).toContain('queue')
  await page.getByRole('button', { name: '停止', exact: true }).click()
  await expect.poll(() => cancellations).toBe(1)
  await expect(page.getByRole('button', { name: '停止', exact: true })).toBeHidden()

  await editor.fill('接管期间保留的草稿')
  for (const kind of ['user-questions', 'plan-review']) {
    await page.evaluate((kind) => {
      const ctx = window.__nbTestContext, React = window.__nbTestReact, sessionId = ctx.sessions.list.getSnapshot().current
      const publish = ctx.get('uiSession').registerPendingInteraction(() => 100)
      const remove = publish({ key: `noteboard-test-${kind}`, kind, sessionId }, () => {})
      let dispose
      const complete = () => { remove(); dispose() }
      dispose = ctx.slots.register({ name: 'conversation.composer', id: 'noteboard-test-takeover', priority: -50, select: (owner) => owner.sessionId === sessionId ? { kind } : null },
        () => React.createElement('section', { 'data-conversation-composer-overlay': '', role: 'dialog', 'aria-label': kind, style: { background: 'white', padding: 24 } }, React.createElement('button', { onClick: complete }, '完成测试交互')))
    }, kind)
    await expect(page.getByRole('dialog', { name: kind })).toBeVisible()
    await expect(page.locator('.nb-composer-custom')).toHaveCount(0)
    await page.getByRole('button', { name: '完成测试交互', exact: true }).click()
    await expect(page.locator('.nb-composer-custom')).toBeVisible()
    await expect(editor).toHaveText('接管期间保留的草稿')
  }
  expect(errors).toEqual([])
  console.log('PASS: dual-state composer, references, text lifecycle, heading ownership, responsive screenshots, intercepted send/failure/queue/stop and composer takeovers')
} catch (error) {
  await screenshot('failure')
  console.error('PAGE ERRORS', errors)
  console.error((await page.locator('body').innerText()).slice(-2500))
  throw error
} finally {
  await context.close(); await browser.close(); await rm(root, { recursive: true, force: true })
}
