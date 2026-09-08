import { it, expect } from 'vitest'
import { listSourceSessions, readSourceSession } from '../src/extraction.mjs'

const user = (seq, text, source = { kind: 'user' }) => ({ seq, time: seq * 100, type: 'user/message', data: { source, content: [{ type: 'text', text }] } })
const assistant = (seq, text) => ({ seq, time: seq * 100, type: 'assistant/message', data: { message: { content: [{ type: 'text', text }, { type: 'reasoning', text: 'hidden reasoning' }] } } })
const current = (events) => ({ id: 'current', header: { id: 'current', cwd: '/workspace' }, snapshotEvents: () => events })

it('reads original conversation including pre-compaction messages, excluding injected and tool text', async () => {
  const events = [user(0, 'Original decision'), assistant(1, 'Original response'),
    user(2, 'Injected context', { kind: 'plugin', plugin: 'compact', form: 'recall' }),
    { seq: 3, time: 300, type: 'tool/result', data: { message: { content: [{ type: 'text', text: 'tool output' }] } } },
    user(4, 'Correction'), assistant(5, 'Updated answer')]
  const page = await readSourceSession(null, current(events))
  expect(page.messages.map((m) => m.text)).toEqual(['Original decision', 'Original response', 'Correction', 'Updated answer'])
  expect(page.messages[0].source.seq).toBe(0)
  expect(page.complete).toBe(true)
  expect(JSON.stringify(page)).not.toMatch(/hidden reasoning|Injected context|tool output/)
})
it('reads inclusive sequence, time and role ranges from an explicitly selected historical session', async () => {
  const query = { async readSession(id) { expect(id).toBe('history'); return { session: { id, cwd: '/elsewhere' }, events: [user(0, 'A'), assistant(1, 'B'), user(2, 'C'), assistant(3, 'D')] } } }
  const page = await readSourceSession(query, current([]), { sessionId: 'history', fromSeq: 1, toSeq: 3, fromTime: 150, toTime: 300, roles: ['assistant'] })
  expect(page.messages.map((m) => m.text)).toEqual(['D'])
  expect(page.sameWorkspace).toBe(false)
  expect(page.messages[0].source.sessionId).toBe('history')
})
it('paginates long messages without loss and pins the snapshot boundary while the session grows', async () => {
  const text = 'ab\uD83D\uDE00cdefghijklmnop'
  const events = [user(0, text), assistant(1, 'Tail')]
  const session = current(events)
  let page = await readSourceSession(null, session, { maxChars: 3, limit: 1 })
  const firstBoundary = page.capturedThroughSeq
  const received = []
  events.push(user(2, 'Added later'))
  for (let i = 0; i < 30; i++) {
    received.push(...page.messages)
    expect(page.capturedThroughSeq).toBe(firstBoundary)
    expect(page.messages.every((m) => m.text.isWellFormed())).toBe(true)
    if (page.complete) break
    expect(page.next).not.toBeNull()
    page = await readSourceSession(null, session, page.next)
  }
  expect(page.complete).toBe(true)
  expect(received.filter((m) => m.seq === 0).map((m) => m.text).join('')).toBe(text)
  expect(received.filter((m) => m.seq === 1).map((m) => m.text).join('')).toBe('Tail')
  expect(received.some((m) => m.seq === 2)).toBe(false)
})
it('reports non-text material and handles empty results and invalid cursors', async () => {
  const event = user(0, 'See attachment')
  event.data.content.push({ type: 'image', url: 'attachment' })
  expect((await readSourceSession(null, current([event]))).nonTextBlocks).toBe(1)
  expect(await readSourceSession(null, current([]))).toMatchObject({ messages: [], complete: true, capturedThroughSeq: null })
  expect((await readSourceSession(null, current([event]), { fromTime: 10 })).messages).toEqual([])
  for (const args of [{ fromSeq: 2, toSeq: 1 }, { fromTime: 3, toTime: 2 }, { roles: ['system'] }, { maxChars: 0 }, { offset: 100 }, { fromSeq: 1, offset: 1 }]) await expect(readSourceSession(null, current([event]), args)).rejects.toThrow()
})
it('finds and paginates same-workspace sessions by title, retaining unavailable titles as IDs', async () => {
  const query = {
    async filterSessions(filters) { expect(filters).toEqual([{ kind: 'cwd', values: ['/workspace'] }]); return [1, 2, 3].map((n) => ({ header: { id: `s${n}`, createdAt: n }, live: false, persisted: true })) },
    async readTitleSnapshots(ids) { return ids.map((sessionId) => sessionId === 's3' ? { sessionId, status: 'rejected', reason: new Error('Unavailable') } : { sessionId, status: 'fulfilled', value: { title: { title: `Plan ${sessionId}` } } }) },
  }
  const first = await listSourceSessions(query, '/workspace', { query: 'Plan', limit: 1 })
  expect(first.sessions.map((s) => s.sessionId)).toEqual(['s1'])
  expect(first.total).toBe(2)
  expect((await listSourceSessions(query, '/workspace', first.next)).sessions.map((s) => s.sessionId)).toEqual(['s2'])
  expect((await listSourceSessions(query, '/workspace', { query: 's3' })).sessions[0]).toMatchObject({ title: 's3', titleUnavailable: true })
})
