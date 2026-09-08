import { describe, expect, it } from 'vitest'
import { createReplyTracker } from '../src/client/replies'

function turn(id: number, { ended = true, reason = 'completed', text = '已整理便签', time = 2000, status = 'settled', blocks }: any = {}) {
  return { turn: id, start: { seq: id * 10 }, end: ended ? { seq: id * 10 + 9, time, data: { reason: { kind: reason } } } : undefined,
    data: new Map([['turn-tail', { closing: { status, blocks: blocks ?? [{ kind: 'text', text }] } }]]) }
}
const snapshot = (...turns: any[]) => ({ timeline: { turns: new Map(turns.map((t) => [t.turn, t])) } })

describe('canvas reply notifications', () => {
  it('ignores history, steps and repeat publication; emits the completed turn once', () => {
    const read = createReplyTracker(snapshot(turn(1)), 1500)
    expect(read(snapshot(turn(1), turn(2, { ended: false })))).toBeNull()
    expect(read(snapshot(turn(1), turn(2)))).toEqual({ turn: 2, text: '已整理便签' })
    expect(read(snapshot(turn(2)))).toBeNull()
    expect(read(snapshot(turn(0), turn(2)))).toBeNull()
  })
  it('does not notify for aborted, failed, interrupted or reasoning-only turns', () => {
    const read = createReplyTracker(snapshot(), 1500)
    expect(read(snapshot(turn(1, { reason: 'aborted' }), turn(2, { reason: 'error' }), turn(3, { status: 'interrupted' }), turn(4, { blocks: [{ kind: 'reasoning', text: '思考' }, { kind: 'tool-call' }] })))).toBeNull()
  })
  it('ignores history arriving after mount and returns the newest visible reply', () => {
    const read = createReplyTracker(snapshot(), 1500)
    expect(read(snapshot(turn(1, { time: 1000 })))).toBeNull()
    expect(read(snapshot(turn(2), turn(3, { text: '最新回复' })))).toEqual({ turn: 3, text: '最新回复' })
    expect(createReplyTracker(snapshot(turn(3)), 3000)(snapshot(turn(3)))).toBeNull()
  })
  it('includes only final text blocks and handles a turn already running on entry', () => {
    const read = createReplyTracker(snapshot(turn(1, { ended: false })), 1500)
    expect(read(snapshot(turn(1, { blocks: [{ kind: 'reasoning', text: '内部思考' }, { kind: 'text', text: '第一段' }, { kind: 'tool-call' }, { kind: 'text', text: '第二段' }] })))).toEqual({ turn: 1, text: '第一段\n\n第二段' })
  })
})
