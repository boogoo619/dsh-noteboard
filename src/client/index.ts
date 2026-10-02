/**
 * Noteboard, browser half (`dsh-noteboard/client`).
 *
 * Registers slots (all additive; lifecycle on the plugin Fiber):
 * - `conversation.view`    → the 画布 tab (workspace-wide data, session-scoped mount)
 * - `shell.overlay`        → text-selection capture buttons + result toast
 * - `plugins.bundle.config` → the bundle's configuration page on the dsh 0.2
 *   sidebar Plugins page (keyed by npm package name); the dsh <= 0.1
 *   Settings → Plugins tab card (`settings.plugin.item`) stays registered for
 *   older hosts — exactly one slot exists per dsh generation.
 *
 * Preference values: dsh 0.2 serves the entry's Config form through
 * `configForms.get('noteboard')` (keyed by the loader entry id, which must
 * match cordis.patch.yml); dsh <= 0.1 bound the served namespace through the
 * now-retired `settingsScope` service. Both wires are attached reactively —
 * the inject of the generation that is absent simply never fires.
 */
import { createElement } from 'react'
import { CanvasView } from './canvas/CanvasView'
import { CaptureOverlay } from './overlay/CaptureOverlay'
import { NoteboardSettingsCard } from './settingsCard'
import { CANVAS_CSS } from './styles'
import { createIntegration } from './integration'
import { registerToolResults } from './ToolResult'
import { createComposer } from './composer'
import { createPreferences } from './preferences'

const NS = 'noteboard'
/** npm package name — the key `plugins.bundle.config` dispatches on (dsh 0.2). */
const PACKAGE_NAME = 'dsh-noteboard'

export default {
  // `sessions` resolves the current session (回链 + workspace cwd) for the
  // overlay and the「打开对话」jump, and feeds the canvas view's cwd.
  inject: ['slots', 'sessions'],
  apply(ctx: any) {
    const sessions = ctx.sessions
    const conversation = ctx.get('conversation')
    const integration = createIntegration(ctx)
    const composer = createComposer(ctx, integration)
    const preferences = createPreferences()
    ctx.effect(() => () => preferences.dispose())
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
    }, (props: any) => createElement(CanvasView, { ...props, sessions, integration, composer, preferences }))))

    ctx.effect(() => slots.inject('shell.overlay', () => slots.register({
      name: 'shell.overlay',
      id: `${NS}-capture`,
      order: 500,
    }, (props: any) => createElement(CaptureOverlay, { ...props, sessions, conversation, integration, preferences }))))

    // dsh 0.2 — preference values come from the entry's Config form
    // (`configForms.get`, keyed by the loader entry id). The same protocol as
    // the legacy scope (getSnapshot {status,value,writable} / subscribe /
    // mutate), so `preferences.attach` binds it unchanged.
    ctx.inject(['configForms'], (scopeCtx: any) => {
      const forms = scopeCtx?.configForms
      if (!forms || typeof forms.get !== 'function') return
      return scopeCtx.effect(() => preferences.attach(forms.get(NS)))
    })

    // dsh <= 0.1 legacy — the settings transport bound the served namespace.
    // The slot changed shape between dsh 0.1 releases: register BOTH the keyed
    // form (key = namespace) and the older list form — the dual-shape trick
    // dsh-focus-overlay uses; unknown options are ignored. On dsh 0.2 neither
    // the service nor the slot exists, so this whole branch stays dormant.
    ctx.inject(['settingsScope'], (scopeCtx: any) => {
      const scope = scopeCtx?.settingsScope
      if (!scope || typeof scope.bind !== 'function') return
      scopeCtx.effect(() => preferences.attach(scope.bind({ namespace: NS })))
      return scopeCtx.effect(() => scopeCtx.slots.inject('settings.plugin.item', () => scopeCtx.slots.register({
        name: 'settings.plugin.item',
        key: NS,
        id: NS,
        order: 500,
      }, () => createElement(NoteboardSettingsCard, { preferences }))))
    })

    // dsh 0.2 — the bundle's own configuration page on the sidebar Plugins
    // page, keyed by npm package name. The page draws the title/icon/crumb and
    // the save control itself and only ever asks for `view: 'page'`.
    ctx.effect(() => slots.inject('plugins.bundle.config', () => slots.register({
      name: 'plugins.bundle.config',
      key: PACKAGE_NAME,
    }, () => createElement(NoteboardSettingsCard, { preferences }))))
  },
}
