/**
 * Durable capture, canvas, distill and history preferences:
 * one namespace served through the official settings system, edited by the
 * Plugins-tab card (`settings.plugin.item`, keyed by this namespace).
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

export const NoteboardSettingsSchema = z.object(Object.fromEntries(
  Object.entries(DEFAULT_PREFERENCES).map(([key, value]) => [key,
    (PREFERENCE_CHOICES[key] ? z.union(PREFERENCE_CHOICES[key]) : typeof value === 'boolean' ? z.boolean() : z.string()).default(value),
  ]),
))

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
