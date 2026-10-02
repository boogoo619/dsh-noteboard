/**
 * Durable capture, canvas, distill and history preferences.
 *
 * dsh 0.2: served as this plugin entry's own Config (see `Config` below) —
 * the sidebar Plugins page renders a form from it, the host reads the live
 * value through `ctx.fiber.config`, and the browser half syncs through
 * `configForms.get('noteboard')` (entry id, must match cordis.patch.yml).
 *
 * dsh <= 0.1 legacy: one namespace served through the former settings
 * system, edited by the retired Plugins-tab card (`settings.plugin.item`,
 * keyed by this namespace). `registerSettings` keeps that path alive; it
 * no-ops on 0.2, where `ctx.settings` has no `register`.
 *
 * Registration is REACTIVE: the settings provider may mount after this row
 * activates (it did on the deployed profile, which is why the card never
 * appeared). `ctx.inject(['settings'], …)` (the pattern dsh-focus-overlay and
 * dsh-better-sidebar use) registers the moment the service shows up and
 * unregisters when it goes away; the returned handle stays valid either way.
 */

import z from '@deepseek-ai/schemastery'
import { DEFAULT_PREFERENCES, PREFERENCE_CHOICES } from './preferences.mjs'

export const NAMESPACE = 'noteboard'

const preferenceSchema = (volatile) => z.object(Object.fromEntries(
  Object.entries(DEFAULT_PREFERENCES).map(([key, value]) => {
    const field = PREFERENCE_CHOICES[key] ? z.union(PREFERENCE_CHOICES[key]) : typeof value === 'boolean' ? z.boolean() : z.string()
    // `.volatile()` arrived in schemastery 3.18.4 (the version dsh 0.2 ships);
    // guard so an older dev-side resolution only loses live-apply, not the build.
    const marked = volatile && typeof field.volatile === 'function' ? field.volatile() : field
    return [key, marked.default(value)]
  }),
))

export const NoteboardSettingsSchema = preferenceSchema(false)

/**
 * dsh 0.2 plugin-entry Config: the same preference fields, each marked
 * volatile so Plugins-page edits apply live (config-only fiber updates never
 * restart the plugin). Served through the entry's settings form, keyed by the
 * loader entry id (`noteboard` in cordis.patch.yml).
 */
export const Config = preferenceSchema(true)

/**
 * Register the namespace whenever a settings provider is mounted and return a
 * late-bound read handle: `get()` answers the resolved value once the
 * namespace is served, `{}` before that (callers treat missing keys as
 * "auto"). Never throws — a deployment without the settings service simply
 * keeps the built-in distill defaults.
 */
export function registerSettings(ctx) {
  let scope = null
  try {
    ctx.inject(['settings'], (sctx) => {
      const settings = sctx?.settings
      if (!settings || typeof settings.register !== 'function') return
      try {
        scope = settings.register(NAMESPACE, NoteboardSettingsSchema)
        sctx.effect(() => () => { scope = null })
      } catch (error) {
        scope = null
        console.warn('[dsh-noteboard] settings namespace registration failed:', error)
      }
    })
  } catch (error) {
    console.warn('[dsh-noteboard] settings inject unavailable:', error)
  }
  return {
    get: () => (scope && typeof scope.get === 'function' ? scope.get() : undefined),
  }
}
