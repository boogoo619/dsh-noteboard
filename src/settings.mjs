/**
 * Durable settings for the noteboard plugin (spec §3.4 用户可配置的提炼):
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

export const NAMESPACE = 'noteboard'

/** Built-in distill prompt — shown as the card's placeholder; '' means "use this". */
export const BUILTIN_PROMPT = [
  '把 <text> 标签里的文字提炼成一张便签。只输出一个 JSON 对象，不要输出任何其他文字：',
  '{"title": "不超过12字的标题", "tags": ["1-3个中文标签"], "body": "精炼后的 Markdown 正文，保留关键事实与数字，不超过200字"}',
].join('\n')

/** Assemble the distill user message: instruction + delimited selection. */
export function distillMessage(selectedText, customPrompt = '') {
  const instruction = (customPrompt ?? '').trim() || BUILTIN_PROMPT
  return `${instruction}\n<text>\n${String(selectedText ?? '').trim()}\n</text>`
}

export const NoteboardSettingsSchema = z.object({
  /** 提炼用的 provider 路由键；'' = 自动选择第一个可用 provider。 */
  provider: z.string().default(''),
  /** 提炼用的模型 id；'' = 该 provider 下的第一个模型。 */
  model: z.string().default(''),
  /** 提炼提示词；'' = 使用内置提示词。 */
  prompt: z.string().default(''),
})

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
