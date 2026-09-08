import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPreferences, type PreferenceScope } from '../src/client/preferences'
import { DEFAULT_PREFERENCES } from '../src/preferences.mjs'

function binding(initial: Record<string, unknown> = {}) {
  let value = { ...DEFAULT_PREFERENCES, ...initial }
  const listeners = new Set<() => void>()
  const scope: PreferenceScope = {
    getSnapshot: () => ({ status: 'ready', writable: true, value, base: DEFAULT_PREFERENCES }),
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    mutate: vi.fn(async (ops) => {
      for (const op of ops) value = { ...value, [op.path[0]]: op.op === 'set' ? op.value : DEFAULT_PREFERENCES[op.path[0] as keyof typeof DEFAULT_PREFERENCES] }
      listeners.forEach((fn) => fn())
    }),
  }
  return scope
}
afterEach(() => vi.useRealTimers())

describe('reactive preferences and durable edits', () => {
  it('reads without writing, observes updates without a settings panel, and reconnects', async () => {
    const store = createPreferences(), scope = binding({ showGrid: false })
    expect(store.getSnapshot().value.showGrid).toBe(true)
    const detach = store.attach(scope)
    expect(store.getSnapshot().value.showGrid).toBe(false)
    expect(scope.mutate).not.toHaveBeenCalled()
    await scope.mutate([{ op: 'set', path: ['showGrid'], value: true }])
    expect(store.getSnapshot().value.showGrid).toBe(true)
    detach()
    expect(store.getSnapshot().writable).toBe(false)
    store.attach(binding({ showGrid: false }))
    expect(store.getSnapshot().value.showGrid).toBe(false)
    store.dispose()
  })
  it('saves provider/model together and resets a group in one mutation', async () => {
    const store = createPreferences(), scope = binding({ provider: 'old', model: 'old-model', showGrid: false })
    store.attach(scope); store.setProvider('new'); await store.flush()
    expect(scope.mutate).toHaveBeenLastCalledWith([{ op: 'set', path: ['provider'], value: 'new' }, { op: 'set', path: ['model'], value: '' }])
    store.reset(['provider', 'model']); await store.flush()
    expect(scope.mutate).toHaveBeenLastCalledWith([{ op: 'unset', path: ['provider'] }, { op: 'unset', path: ['model'] }])
    expect(store.getSnapshot().value).toMatchObject({ provider: '', model: '', showGrid: false })
    store.dispose()
  })
  it('retains failed input, keeps runtime values accepted-only and retries', async () => {
    const store = createPreferences(), scope = binding()
    vi.mocked(scope.mutate).mockRejectedValueOnce(new Error('offline'))
    store.attach(scope); store.set('defaultColor', 'blue')
    await expect(store.flush()).rejects.toThrow('offline')
    expect(store.getSnapshot()).toMatchObject({ error: 'offline', saved: false, dirty: true, form: { defaultColor: 'blue' }, value: { defaultColor: 'yellow' } })
    await store.flush()
    expect(store.getSnapshot()).toMatchObject({ error: '', saved: true, dirty: false, value: { defaultColor: 'blue' } })
    store.dispose()
  })
  it('preserves edits made while the previous save is pending', async () => {
    const store = createPreferences(), scope = binding()
    const save = vi.mocked(scope.mutate).getMockImplementation()!
    let release!: () => void
    vi.mocked(scope.mutate).mockImplementationOnce(async (ops) => { await new Promise<void>((resolve) => { release = resolve }); await save(ops) })
    store.attach(scope); store.set('defaultColor', 'blue')
    await Promise.resolve()
    store.set('defaultColor', 'pink'); store.set('showGrid', false)
    release(); await store.flush()
    expect(store.getSnapshot().value).toMatchObject({ defaultColor: 'pink', showGrid: false })
    expect(store.getSnapshot().dirty).toBe(false)
    store.dispose()
  })
  it('debounces text and flushes explicitly before preview or blur', async () => {
    vi.useFakeTimers()
    const store = createPreferences(), scope = binding()
    store.attach(scope); store.set('distillInstructions', 'a', true)
    await vi.advanceTimersByTimeAsync(200)
    store.set('distillInstructions', 'ab', true)
    await vi.advanceTimersByTimeAsync(399)
    expect(scope.mutate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(store.getSnapshot().value.distillInstructions).toBe('ab')
    store.set('distillInstructions', 'abc', true); await store.flush()
    expect(store.getSnapshot().value.distillInstructions).toBe('abc')
    store.dispose()
  })
  it('does not write through an unavailable or read-only scope', async () => {
    const store = createPreferences(), scope = binding()
    const snapshot = scope.getSnapshot()
    scope.getSnapshot = () => ({ ...snapshot, writable: false })
    store.attach(scope)
    store.set('showGrid', false)
    await expect(store.flush()).rejects.toThrow('暂不可写')
    expect(scope.mutate).not.toHaveBeenCalled()
    expect(store.getSnapshot().value.showGrid).toBe(true)
    expect(store.getSnapshot().form.showGrid).toBe(false)
    store.dispose()
  })
})
