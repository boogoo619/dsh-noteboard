/**
 * Plugins-tab settings card (「设置 → 插件 → Noteboard」): distill provider /
 * model / prompt, persisted through the official settingsScope service so the
 * Host distill path reads the same durable values. Layout mirrors the official
 * Plugins section (760px section, 12px-radius bg-layer-3 cards, 13px/500
 * labels, 12px tertiary hints); controls use the official `Button` / `Input`
 * primitives plus theme-variable styled select/textarea.
 */
import { createElement, useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { rpc } from './api'

interface LlmOption { id: string; name: string; models: { id: string; name: string }[] }

/** Reactive hook over one settingsScope binding. */
function useScope(scope: any) {
  const [snap, setSnap] = useState(() => scope?.getSnapshot?.())
  useEffect(() => {
    if (!scope?.subscribe) return
    setSnap(scope.getSnapshot())
    return scope.subscribe(() => setSnap(scope.getSnapshot()))
  }, [scope])
  return snap
}

export function NoteboardSettingsCard({ settingsScope }: any) {
  const [scope, setScope] = useState<any>(null)
  useEffect(() => {
    try {
      const binder = settingsScope
      setScope(binder && typeof binder.bind === 'function' ? binder.bind({ namespace: 'noteboard' }) : null)
    } catch { setScope(null) }
  }, [settingsScope])

  const snap = useScope(scope)
  const value: any = snap?.value ?? {}
  const writable = snap?.writable !== false

  const [options, setOptions] = useState<LlmOption[]>([])
  useEffect(() => {
    // Provider/model roster comes from the host (this route ignores the root).
    rpc('/', 'llmOptions').then((r) => setOptions(r ?? []), () => setOptions([]))
  }, [])

  if (!snap || snap.status === 'unavailable') {
    return createElement('div', { className: 'nb-set-card' }, '设置不可用（偏好为进程内存模式）')
  }

  const set = (field: string, v: string) => { scope?.set?.(field, v)?.catch?.(() => {}) }

  const selectedProvider = value.provider || ''
  const modelsOf: LlmOption['models'] = (selectedProvider && options.find((o) => o.id === selectedProvider)?.models) || []

  return createElement('div', { className: 'nb-set-card' },
    createElement('div', { className: 'nb-set-field' },
      createElement('label', { className: 'nb-set-label' }, '提炼 Provider'),
      createElement('select', {
        className: 'nb-set-select', disabled: !writable,
        value: selectedProvider,
        onChange: (e: any) => { set('provider', e.target.value); set('model', '') },
      },
        createElement('option', { value: '' }, '自动（第一个可用）'),
        options.map((o) => createElement('option', { key: o.id, value: o.id }, o.name))),
      createElement('p', { className: 'nb-set-hint' }, 'AI 提炼使用的模型提供方；留空自动选择。')),

    createElement('div', { className: 'nb-set-field' },
      createElement('label', { className: 'nb-set-label' }, '提炼模型'),
      createElement('select', {
        className: 'nb-set-select', disabled: !writable,
        value: value.model || '',
        onChange: (e: any) => set('model', e.target.value),
      },
        createElement('option', { value: '' }, '自动（该 Provider 第一个模型）'),
        modelsOf.map((m) => createElement('option', { key: m.id, value: m.id }, m.name))),
      createElement('p', { className: 'nb-set-hint' }, '建议选用指令遵循好、非推理型模型，输出更稳定。')),

    createElement('div', { className: 'nb-set-field' },
      createElement('label', { className: 'nb-set-label' }, '提炼提示词'),
      createElement('textarea', {
        className: 'nb-set-textarea', rows: 5, disabled: !writable,
        placeholder: '留空使用内置提示词（要求模型输出 {title, tags, body} JSON）。可自定义提炼风格与输出结构。',
        value: value.prompt ?? '',
        onChange: (e: any) => set('prompt', e.target.value),
      }),
      createElement('p', { className: 'nb-set-hint' },
        '自定义提示词应要求模型只输出一个 JSON 对象：{"title","tags","body"}。')),

    createElement('div', { className: 'nb-set-footer' },
      createElement('span', { className: 'nb-set-status' },
        snap.status === 'loading' ? '读取中…' : writable ? '更改即保存' : '只读'),
      createElement(Button, {
        variant: 'outline', size: 'sm', disabled: !writable,
        onClick: () => { set('provider', ''); set('model', ''); set('prompt', '') },
      }, '恢复默认')),
  )
}
