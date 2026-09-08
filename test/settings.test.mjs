import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readdir, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApi } from '../src/commands.mjs'
import { DEFAULT_PREFERENCES, resolvePreferences } from '../src/preferences.mjs'
import { NoteboardSettingsSchema } from '../src/settings.mjs'
import { history } from '../src/persistence.mjs'

let root, api, prefs, calls
function llm() {
  return {
    listProviders: () => [{ id: 'empty' }, { id: 'working', name: 'Working' }],
    listModels: async (id) => id === 'empty' ? [] : [{ id: 'm1' }, { id: 'm2' }],
    stream(request) {
      calls.push(request)
      return (async function* () { yield { type: 'text-delta', text: JSON.stringify({ title: '结果', tags: ['主题'], body: '关键数字 123。'.repeat(100) }) } })()
    },
  }
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'noteboard-settings-'))
  prefs = {}; calls = []; api = buildApi(); api.settingsHandle = { get: () => prefs }; api.llm = llm()
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

describe('settings contract', () => {
  it('resolves shared defaults and rejects invalid persisted choices', () => {
    expect(NoteboardSettingsSchema({})).toEqual(DEFAULT_PREFERENCES)
    expect(() => NoteboardSettingsSchema({ historyLimit: 0 })).toThrow()
    expect(() => NoteboardSettingsSchema({ wheelBehavior: 'wrong' })).toThrow()
    expect(resolvePreferences({ historyLimit: 0, showGrid: 'false' })).toEqual(DEFAULT_PREFERENCES)
  })
  it('applies defaults across single, batch and distilled notes without changing existing notes', async () => {
    await api.state(root)
    prefs.defaultColor = 'blue'
    const first = await api.createNote(root, { title: 'single' })
    const batch = await api.createNotes(root, { notes: [{ title: 'default' }, { title: 'explicit', color: 'pink' }] })
    const distilled = await api.distillNote(root, { text: 'source' })
    expect([first.note.color, ...batch.notes.map((n) => n.color), distilled.note.color]).toEqual(['blue', 'blue', 'pink', 'blue'])
    prefs.defaultColor = 'green'
    expect((await api.query(root, { ids: [first.note.id] })).notes[0].color).toBe('blue')
  })
})

describe('distill previews and routing', () => {
  it.each([
    ['short', 100, 800], ['standard', 200, 1200], ['detailed', 400, 2000],
  ])('uses %s length without truncating the generated body', async (distillLength, words, tokens) => {
    prefs = { distillLength, distillInstructions: '保留所有数字' }
    const preview = await api.distillPreview(root, { text: 'original' })
    expect(preview).toMatchObject({ provider: 'working', model: 'm1' })
    expect(preview.body.length).toBeGreaterThan(400)
    expect(calls[0].maxTokens).toBe(tokens)
    expect(calls[0].messages[1].content[0].text).toContain(`约 ${words}`)
    expect(calls[0].messages[1].content[0].text).toContain('保留所有数字')
    expect(await readdir(root)).toEqual([])
  })
  it.each([['zh', '中文'], ['en', '英文'], ['source', '与原文相同的语言']])('uses %s language', async (distillLanguage, expected) => {
    prefs.distillLanguage = distillLanguage
    await api.distillPreview(root, { text: 'original' })
    expect(calls[0].messages[1].content[0].text).toContain(`使用${expected}`)
  })
  it('uses the same route and content for preview and creation', async () => {
    prefs = { provider: 'working', model: 'm2' }
    const options = await api.llmOptions(root)
    const preview = await api.distillPreview(root, { text: 'source' })
    expect(options.resolved).toEqual({ provider: preview.provider, model: preview.model })
    expect(await readdir(root)).toEqual([])
    const result = await api.distillNote(root, { text: 'source' })
    expect(result.note).toMatchObject({ title: preview.title, body: preview.body, tags: preview.tags })
    expect(calls[1]).toEqual(calls[0])
  })
  it('skips failed automatic providers but does not replace explicitly selected models', async () => {
    api.llm.listModels = async (id) => { if (id === 'empty') throw new Error('offline'); return [{ id: 'm1' }] }
    expect((await api.llmOptions(root)).resolved.provider).toBe('working')
    prefs.provider = 'empty'
    await expect(api.distillPreview(root, { text: 'source' })).rejects.toThrow('offline')
    prefs = { provider: 'missing' }
    await expect(api.distillPreview(root, { text: 'source' })).rejects.toThrow('已不可用')
    prefs = { provider: 'working', model: 'missing' }
    expect((await api.llmOptions(root)).resolved).toBeNull()
    await expect(api.distillPreview(root, { text: 'source' })).rejects.toThrow('不可用')
    expect(calls).toHaveLength(0)
  })
  it('rejects empty input and malformed output without writing', async () => {
    await expect(api.distillPreview(root, { text: ' ' })).rejects.toThrow('填写')
    api.llm.stream = () => (async function* () { yield { type: 'text-delta', text: 'broken' } })()
    await expect(api.distillPreview(root, { text: 'source' })).rejects.toThrow('无法解析')
    expect(await readdir(root)).toEqual([])
  })
})

describe('history retention', () => {
  it.each([50, 100, 200])('retains %i records after a successful write, protects pending records, and restores retained operations', async (limit) => {
    await api.state(root)
    const directory = join(root, '.noteboard/history')
    await mkdir(directory, { recursive: true })
    await Promise.all(Array.from({ length: 205 }, (_, i) => writeFile(join(directory, `old-${i}.json`), JSON.stringify({ id: `old-${i}`, created: new Date(i * 1000).toISOString(), status: 'complete', files: [] }))))
    await writeFile(join(directory, 'pending.json'), JSON.stringify({ id: 'pending', created: '1900', status: 'pending', files: [] }))
    prefs.historyLimit = limit
    expect(await history(root)).toHaveLength(206)
    const result = await api.createNote(root, { title: 'retained' })
    const records = await history(root)
    expect(records.filter((r) => r.status !== 'pending')).toHaveLength(limit)
    expect(records.some((r) => r.id === 'pending')).toBe(true)
    await api.restoreOperation(root, { id: result.operationId })
    expect((await api.state(root)).notes).toHaveLength(0)
  })
})
