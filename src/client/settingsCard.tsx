import React, { useEffect, useId, useState } from 'react'
import { ChevronDown, RotateCcw, RefreshCw, Sparkles } from 'lucide-react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { rpc } from './api'
import { COLOR_NAMES, IconButton } from './ui'
import { renderMarkdown } from './markdown'
import { type PreferenceKey, type PreferenceStore } from './preferences'
import { usePreferences } from './usePreferences'

interface LlmOption { id: string; name: string; models: { id: string; name: string }[]; error?: string }
interface LlmOptions { providers: LlmOption[]; resolved: { provider: string; model: string } | null; error?: string }
const groups: Record<string, PreferenceKey[]> = {
  '采集': ['captureEnabled', 'captureAfter'],
  '便签与画布': ['defaultColor', 'showGrid', 'snapToGrid', 'wheelBehavior', 'openingView'],
  'AI 提炼': ['provider', 'model', 'distillLength', 'distillLanguage', 'distillInstructions'],
  '数据与恢复': ['historyLimit'],
}

export function NoteboardSettingsCard({ preferences }: { preferences: PreferenceStore }) {
  const state = usePreferences(preferences), value = state.form
  const id = useId()
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<LlmOptions | null>(null), [optionsError, setOptionsError] = useState(''), [reload, setReload] = useState(0), [optionsLoading, setOptionsLoading] = useState(false)
  const [testing, setTesting] = useState(false), [testOpen, setTestOpen] = useState(false), [testText, setTestText] = useState(''), [testError, setTestError] = useState(''), [result, setResult] = useState<any>(null)
  const disabled = !state.writable || testing
  useEffect(() => {
    if (!open || state.status !== 'ready') return
    let alive = true
    setOptionsLoading(true); setOptionsError('')
    rpc('/', 'llmOptions').then((next) => { if (alive) setOptions(next) }, (e) => { if (alive) { setOptions(null); setOptionsError(e.message) } }).finally(() => { if (alive) setOptionsLoading(false) })
    return () => { alive = false }
  }, [open, state.status, state.value.provider, state.value.model, reload])
  useEffect(() => () => { void preferences.flush().catch(() => {}) }, [preferences])
  const models = options?.providers.find((p) => p.id === (value.provider || options.resolved?.provider))?.models ?? []
  const currentProvider = options?.providers.find((p) => p.id === options.resolved?.provider)
  const currentModel = currentProvider?.models.find((m) => m.id === options?.resolved?.model)
  function section(title: string, children: React.ReactNode) {
    return <section className="nb-set-section" aria-label={title}><header><h3>{title}</h3><IconButton icon={RotateCcw} label={`恢复${title}默认值`} disabled={disabled} onClick={() => preferences.reset(groups[title])}/></header>{children}</section>
  }
  function select(key: PreferenceKey, label: string, choices: [string | number, string][], hint?: string) {
    return <div className="nb-set-field"><label htmlFor={`${id}-${key}`}>{label}</label><div className="nb-set-select-wrap"><select id={`${id}-${key}`} className="nb-set-select" disabled={disabled} value={String(value[key])} onChange={(e) => key === 'provider' ? preferences.setProvider(e.target.value) : preferences.set(key, key === 'historyLimit' ? Number(e.target.value) : e.target.value)}>{choices.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select><span className="nb-set-select-arrow" aria-hidden="true"><IconChevronDownOutline14 size={14}/></span></div>{hint && <p className="nb-set-hint">{hint}</p>}</div>
  }
  function toggle(key: PreferenceKey, label: string) {
    return <label className="nb-set-toggle"><span>{label}</span><input type="checkbox" role="switch" checked={Boolean(value[key])} disabled={disabled} onChange={(e) => preferences.set(key, e.target.checked)}/></label>
  }
  async function preview() {
    setTesting(true); setResult(null); setTestError('')
    try {
      await preferences.flush()
      setResult(await rpc('/', 'distillPreview', { text: testText }))
    } catch (e: any) { setTestError(e.message) }
    finally { setTesting(false) }
  }
  const missingProvider = value.provider && !options?.providers.some((p) => p.id === value.provider)
  const missingModel = value.model && !models.some((m) => m.id === value.model)
  const status = state.status === 'loading' ? '读取中…' : state.status === 'unavailable' ? '设置暂不可用' : !state.writable ? '只读' : state.error ? `保存失败：${state.error}` : state.saving ? '保存中…' : state.dirty ? '尚未保存' : state.saved ? '已保存' : '更改即保存'
  return <li className="nb-set-card">
    <button type="button" className="nb-set-header" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => { if (open) void preferences.flush().catch(() => {}); setOpen(!open) }}>
      <span><strong>便签画布</strong><span className="nb-set-description">采集、画布交互与 AI 提炼偏好</span></span><ChevronDown size={18} className={open ? 'nb-set-chevron-open' : ''}/>
    </button>
    {open && <div id={`${id}-body`} className="nb-set-body">
      {section('采集', <>{toggle('captureEnabled', '显示划词采集工具栏')}{select('captureAfter', '采集完成后', [['stay', '留在对话'], ['open', '打开便签']])}</>)}
      {section('便签与画布', <>
        <div className="nb-set-field"><span>新便签默认颜色</span><div className="nb-set-colors" role="group" aria-label="新便签默认颜色">{Object.entries(COLOR_NAMES).map(([color, label]) => <button key={color} type="button" className={`nb-swatch color-${color}`} title={label} aria-label={label} aria-pressed={value.defaultColor === color} disabled={disabled} onClick={() => preferences.set('defaultColor', color)}>{value.defaultColor === color && <span/>}</button>)}</div></div>
        {toggle('showGrid', '显示背景网格')}{toggle('snapToGrid', '拖动时吸附网格')}
        {select('wheelBehavior', '普通滚轮操作', [['pan', '平移'], ['zoom', '缩放']])}
        {select('openingView', '打开画布时的视图', [['restore', '恢复上次视图'], ['fit', '显示全部']])}
      </>)}
      {section('AI 提炼', <>
        <p className="nb-set-hint">仅用于「AI 提炼」。画布内的对话与便签工具使用会话模型。</p>
        {select('provider', '模型提供方', [['', '自动选择'], ...(missingProvider ? [[value.provider, `${value.provider}（不可用）`] as [string, string]] : []), ...(options?.providers.map((p): [string, string] => [p.id, p.name]) ?? [])])}
        {select('model', '提炼模型', [['', '自动选择'], ...(missingModel ? [[value.model, `${value.model}（不可用）`] as [string, string]] : []), ...models.map((m): [string, string] => [m.id, m.name])])}
        <div className="nb-set-model-status"><p className="nb-set-hint" role="status">{optionsLoading ? '正在读取模型…' : optionsError || options?.error || (currentProvider && currentModel ? `当前使用：${currentProvider.name} · ${currentModel.name}` : '没有可用模型')}</p><IconButton icon={RefreshCw} label="刷新模型列表" disabled={optionsLoading || testing} onClick={() => setReload((n) => n + 1)}/></div>
        {select('distillLength', '正文长度', [['short', '简短 · 约 100 字'], ['standard', '标准 · 约 200 字'], ['detailed', '详细 · 约 400 字']], '英文按词计，实际长度由内容决定。')}
        {select('distillLanguage', '输出语言', [['source', '跟随原文'], ['zh', '中文'], ['en', '英文']])}
        <details className="nb-set-advanced"><summary>高级设置</summary><div className="nb-set-field"><label htmlFor={`${id}-instructions`}>额外提炼要求</label><textarea id={`${id}-instructions`} className="nb-set-textarea" rows={4} disabled={disabled} value={value.distillInstructions} placeholder="例如：保留关键数字，用要点组织正文" onChange={(e) => preferences.set('distillInstructions', e.target.value, true)} onBlur={() => void preferences.flush().catch(() => {})}/></div></details>
        <button type="button" className="nb-set-command" aria-expanded={testOpen} onClick={() => setTestOpen(!testOpen)}><Sparkles size={16}/>测试提炼</button>
        {testOpen && <div className="nb-set-test"><label htmlFor={`${id}-sample`}>试写文本</label><textarea id={`${id}-sample`} className="nb-set-textarea" rows={3} value={testText} disabled={testing} onChange={(e) => setTestText(e.target.value)}/><button type="button" className="nb-set-command" disabled={disabled || !testText.trim() || optionsLoading || !options?.resolved} onClick={() => void preview()}><Sparkles size={16}/>{testing ? '正在提炼…' : '开始测试'}</button>{testError && <p className="nb-set-error" role="alert">{testError}</p>}{result && <div className="nb-set-result"><strong>{result.title}</strong><p className="nb-set-hint">{result.tags.join(' · ')}</p><div dangerouslySetInnerHTML={{ __html: renderMarkdown(result.body, { full: true }) }}/><p className="nb-set-hint">{result.provider} · {result.model}</p></div>}</div>}
      </>)}
      {section('数据与恢复', select('historyLimit', '历史记录保留数量', [[50, '最近 50 次'], [100, '最近 100 次'], [200, '最近 200 次']], '各工作区分别保留。减少数量后，在该工作区下一次成功写操作完成时清理超额旧记录；便签和画布文件不受影响。'))}
      <footer className="nb-set-footer"><span className={state.error ? 'nb-set-error' : 'nb-set-hint'} role={state.error ? 'alert' : 'status'}>{status}</span>{state.error && <IconButton icon={RefreshCw} label="重试保存" disabled={!state.writable || state.saving} onClick={() => void preferences.flush().catch(() => {})}/>}</footer>
    </div>}
  </li>
}
