import { resolvePreferences } from '../preferences.mjs'

export interface Preferences {
  captureEnabled: boolean; captureAfter: 'stay' | 'open'; defaultColor: string
  showGrid: boolean; snapToGrid: boolean; wheelBehavior: 'pan' | 'zoom'; openingView: 'restore' | 'fit'
  provider: string; model: string; distillLength: 'short' | 'standard' | 'detailed'
  distillLanguage: 'source' | 'zh' | 'en'; distillInstructions: string; historyLimit: number
}
export type PreferenceKey = keyof Preferences
type Op = { op: 'set'; path: string[]; value: unknown } | { op: 'unset'; path: string[] }
type ScopeSnapshot = { status: 'loading' | 'ready' | 'unavailable'; value?: unknown; base?: unknown; writable: boolean }
export interface PreferenceScope {
  getSnapshot(): ScopeSnapshot
  subscribe(listener: () => void): () => void
  mutate(ops: Op[]): Promise<void>
}

export function createPreferences() {
  let scope: PreferenceScope | null = null
  let scopeState: ScopeSnapshot = { status: 'loading', writable: false }
  let value = resolvePreferences() as Preferences, error = '', saved = false, disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | null = null
  let revision = 0
  const pending = new Map<PreferenceKey, { op: Op; revision: number }>()
  const listeners = new Set<() => void>()
  const snapshot = () => ({
    value,
    form: Object.assign({}, value, Object.fromEntries([...pending].map(([key, { op }]) => [key, op.op === 'set' ? op.value : resolvePreferences(scopeState.base ?? {})[key]]))) as Preferences,
    status: scopeState.status,
    writable: scopeState.status === 'ready' && scopeState.writable,
    saving: Boolean(running), dirty: pending.size > 0, error, saved,
  })
  let current = snapshot()
  const publish = () => { current = snapshot(); if (!disposed) listeners.forEach((fn) => fn()) }
  const read = () => {
    if (!scope) return
    scopeState = scope.getSnapshot()
    if (scopeState.value) value = resolvePreferences(scopeState.value)
    publish()
  }
  async function flush() {
    clearTimeout(timer); timer = undefined
    if (running) return running
    if (!pending.size) return
    if (!scope || !current.writable) {
      error = '设置暂不可写，修改尚未保存'; publish(); throw new Error(error)
    }
    error = ''
    const bound = scope
    // Keep newer edits while a previous batch crosses the wire.
    running = Promise.resolve().then(async () => {
      while (pending.size) {
        if (scope !== bound || !current.writable) throw new Error('设置连接已变化，请重试保存')
        const batch = new Map(pending)
        await bound.mutate([...batch.values()].map(({ op }) => op))
        for (const [key, entry] of batch) if (pending.get(key)?.revision === entry.revision) pending.delete(key)
        saved = true; read()
      }
    }).catch((e) => { error = e.message || '保存失败，请重试'; throw e }).finally(() => { running = null; publish() })
    publish()
    return running
  }
  function queue(ops: Op[], delayed = false) {
    for (const op of ops) pending.set(op.path[0] as PreferenceKey, { op, revision: ++revision })
    saved = false; publish(); clearTimeout(timer)
    if (delayed) timer = setTimeout(() => { void flush().catch(() => {}) }, 400)
    else void flush().catch(() => {})
  }
  return {
    getSnapshot: () => current,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    attach(next: PreferenceScope) {
      scope = next; read()
      const unsubscribe = next.subscribe(read)
      return () => {
        unsubscribe()
        if (scope === next) { scope = null; scopeState = { status: 'unavailable', writable: false }; publish() }
      }
    },
    set(key: PreferenceKey, next: unknown, delayed = false) { queue([{ op: 'set', path: [key], value: next }], delayed) },
    setProvider(provider: string) { queue([{ op: 'set', path: ['provider'], value: provider }, { op: 'set', path: ['model'], value: '' }]) },
    reset(keys: PreferenceKey[]) { queue(keys.map((key) => ({ op: 'unset', path: [key] }))) },
    flush,
    dispose() { disposed = true; clearTimeout(timer); listeners.clear() },
  }
}
export type PreferenceStore = ReturnType<typeof createPreferences>
