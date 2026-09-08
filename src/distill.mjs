/**
 * AI 提炼（Distill, spec §3.4 / decision #7）：Host 直接调 `llm` Service，
 * 不经过对话流。提示词与 provider/model 可被用户设置覆盖（settings.mjs）。
 */

import { BUILTIN_PROMPT, distillMessage } from './settings.mjs'

/** The effective user message: user prompt when set, built-in JSON contract otherwise. */
export function distillPrompt(selectedText, customPrompt = '') {
  return distillMessage(selectedText, customPrompt)
}

/** Remove reasoning-model think blocks that would otherwise confuse JSON extraction. */
export function stripThinking(text) {
  return String(text ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '') // unterminated think block: drop the tail
}

/**
 * Parse the model output; null when it is not usable JSON (no silent retry).
 * Prefers a ```json fence, then the first balanced {...} object.
 */
export function parseDistillResult(rawText) {
  const text = stripThinking(rawText)
  if (!text) return null
  const candidates = []
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1])
  const start = text.indexOf('{')
  if (start !== -1) {
    // First balanced object scanning strings correctly.
    let depth = 0
    let inStr = false
    let esc = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inStr) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) { candidates.push(text.slice(start, i + 1)); break }
      }
    }
  }
  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate.trim())
      if (obj && typeof obj === 'object' && typeof obj.title === 'string' && obj.title.trim()) {
        return {
          title: obj.title.trim().slice(0, 60),
          tags: Array.isArray(obj.tags)
            ? obj.tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()).slice(0, 3)
            : [],
          body: typeof obj.body === 'string' ? obj.body : '',
        }
      }
    } catch { /* try next candidate */ }
  }
  return null
}

/**
 * One model call via the `llm` Service. Provider/model come from user
 * settings when set, else the first registered provider + its first model.
 * Failures throw so the caller can degrade (toast → 改为原文存入).
 */
export async function distill(llm, selectedText, { provider: p, model: m, prompt } = {}, signal) {
  const providers = llm.listProviders()
  if (!providers || providers.length === 0) {
    throw new Error('noteboard: 没有已注册的模型提供方，无法提炼')
  }
  const provider = p || (providers[0].id ?? providers[0].provider ?? providers[0])
  const models = await llm.listModels(provider)
  if (!models || models.length === 0) {
    throw new Error(`noteboard: provider ${provider} 没有可用模型`)
  }
  const model = m || (models[0].id ?? models[0].model ?? models[0])
  let text = ''
  const stream = llm.stream({
    provider,
    model,
    messages: [{ role: 'user', content: [{ type: 'text', text: distillPrompt(selectedText, prompt) }] }],
    temperature: 0.2,
    maxTokens: 800,
    signal,
  })
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') text += chunk.text
    if (chunk.type === 'finish' && chunk.reason === 'aborted') {
      throw new Error('noteboard: 提炼已中止')
    }
  }
  const parsed = parseDistillResult(text)
  if (!parsed) throw new Error('noteboard: 提炼结果无法解析，可在设置中更换模型或自定义提示词')
  return parsed
}
