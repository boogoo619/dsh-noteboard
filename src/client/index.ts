/**
 * Noteboard, browser half (`dsh-noteboard/client`).
 *
 * Registers three slots (all additive; all lifecycle on the plugin Fiber):
 * - `conversation.view`  → the 画布 tab (workspace-wide data, session-scoped mount)
 * - `shell.overlay`      → text-selection capture buttons + result toast
 * - `settings.plugin.item` → Plugins-tab card for the distill provider/model/prompt
 *
 * The settings card registers through a scoped `ctx.inject(['settingsScope'])`
 * so it appears the moment the settings transport mounts (and disappears with
 * it) — a synchronous `ctx.get('settingsScope')` raced the boot order, bound a
 * null scope and produced the "settings panel missing" failure, while the
 * canvas tab itself must never depend on that transport.
 */
import { createElement } from 'react'
import { CanvasView } from './canvas/CanvasView'
import { CaptureOverlay } from './overlay/CaptureOverlay'
import { NoteboardSettingsCard } from './settingsCard'
import { CANVAS_CSS } from './styles'
import { createIntegration } from './integration'
import { registerToolResults } from './ToolResult'
import { createComposer } from './composer'

const NS = 'noteboard'

export default {
  // `sessions` resolves the current session (回链 + workspace cwd) for the
  // overlay and the「打开对话」jump, and feeds the canvas view's cwd.
  inject: ['slots', 'sessions'],
  apply(ctx: any) {
    const sessions = ctx.sessions
    const conversation = ctx.get('conversation')
    const integration = createIntegration(ctx)
    const composer = createComposer(ctx, integration)
    registerToolResults(ctx)
    ctx.effect(() => () => integration.dispose())

    // Package-owned stylesheet; removed with the Fiber.
    const style = document.createElement('style')
    style.setAttribute('data-plugin', NS)
    style.textContent = CANVAS_CSS
    ctx.effect(() => {
      document.head.appendChild(style)
      return () => { style.remove() }
    })

    const slots = ctx.get('slots')
    if (slots === undefined) return

    ctx.effect(() => slots.inject('conversation.view', () => slots.register({
      name: 'conversation.view',
      id: NS,
      label: '画布',
    }, (props: any) => createElement(CanvasView, { ...props, sessions, integration, composer }))))

    ctx.effect(() => slots.inject('shell.overlay', () => slots.register({
      name: 'shell.overlay',
      id: `${NS}-capture`,
      order: 500,
    }, (props: any) => createElement(CaptureOverlay, { ...props, sessions, conversation, integration }))))

    // Plugins-tab settings card, keyed by the Host-served 'noteboard'
    // namespace. The slot changed shape between dsh releases: register BOTH
    // the keyed form (key = namespace) and the older list form — the
    // dual-shape trick dsh-focus-overlay uses; unknown options are ignored.
    // Registered only while the settings scope service is mounted.
    ctx.inject(['settingsScope'], (scopeCtx: any) => {
      const scope = scopeCtx?.settingsScope
      if (!scope || typeof scope.bind !== 'function') return
      return scopeCtx.effect(() => scopeCtx.slots.inject('settings.plugin.item', () => scopeCtx.slots.register({
        name: 'settings.plugin.item',
        key: NS,
        id: NS,
        order: 500,
      }, () => createElement(NoteboardSettingsCard, { settingsScope: scope }))))
    })
  },
}
