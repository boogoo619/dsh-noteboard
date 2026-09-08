import { resolve } from 'node:path'

const integer = (value, name, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const result = value ?? fallback
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new Error(`${name} 超出有效范围`)
  return result
}

export async function listSourceSessions(query, root, args = {}) {
  if (!query?.filterSessions || !query?.readTitleSnapshots) throw new Error('宿主 sessionQuery 服务不可用，无法查找历史会话')
  const limit = integer(args.limit, 'limit', 20, 1, 100)
  const offset = integer(args.offset, 'offset', 0)
  const records = await query.filterSessions([{ kind: 'cwd', values: [root] }])
  const titles = await query.readTitleSnapshots(records.map((r) => r.header.id))
  const byId = new Map(titles.map((r) => [r.sessionId, r]))
  const text = String(args.query ?? '').trim().toLocaleLowerCase()
  const sessions = records.map((r) => {
    const title = byId.get(r.header.id)
    return { sessionId: r.header.id, title: title?.status === 'fulfilled' ? title.value.title?.title ?? r.header.id : r.header.id,
      createdAt: r.header.createdAt, live: r.live, persisted: r.persisted, titleUnavailable: title?.status !== 'fulfilled' }
  }).filter((s) => `${s.sessionId}\n${s.title}`.toLocaleLowerCase().includes(text))
  return { sessions: sessions.slice(offset, offset + limit), total: sessions.length,
    next: offset + limit < sessions.length ? { ...args, offset: offset + limit, limit } : null }
}

/** Read original conversation events, including history replaced by compaction, without exporting injected context. */
export async function readSourceSession(query, current, args = {}) {
  const sessionId = args.sessionId ?? current?.id
  if (typeof sessionId !== 'string' || !sessionId) throw new Error('无法确定来源会话，请提供 sessionId')
  const fromSeq = integer(args.fromSeq, 'fromSeq', 0)
  const toSeq = integer(args.toSeq, 'toSeq', Number.MAX_SAFE_INTEGER)
  const fromTime = integer(args.fromTime, 'fromTime', 0)
  const toTime = integer(args.toTime, 'toTime', Number.MAX_SAFE_INTEGER)
  const offset = integer(args.offset, 'offset', 0)
  const limit = integer(args.limit, 'limit', 40, 1, 100)
  const maxChars = integer(args.maxChars, 'maxChars', 12000, 2, 32000)
  if (fromSeq > toSeq || fromTime > toTime) throw new Error('范围起点不能晚于终点')
  const roles = args.roles ?? ['user', 'assistant']
  if (!Array.isArray(roles) || !roles.length || roles.some((r) => !['user', 'assistant'].includes(r))) throw new Error('roles 仅支持 user 和 assistant')
  let snapshot
  if (sessionId === current?.id && typeof current.snapshotEvents === 'function') snapshot = { session: current.header, events: current.snapshotEvents() }
  else {
    if (!query?.readSession) throw new Error('宿主 sessionQuery 服务不可用，无法读取指定会话')
    snapshot = await query.readSession(sessionId)
  }
  if (!snapshot?.session || !Array.isArray(snapshot.events)) throw new Error('会话读取结果无效')
  const capturedThroughSeq = snapshot.events.at(-1)?.seq ?? null
  const upper = capturedThroughSeq === null ? null : Math.min(toSeq, capturedThroughSeq)
  const candidates = []
  let nonTextBlocks = 0
  for (const event of snapshot.events) {
    if (event.seq < fromSeq || upper === null || event.seq > upper || event.time < fromTime || event.time > toTime) continue
    const role = event.type === 'user/message' && event.data.source?.kind === 'user' ? 'user' : event.type === 'assistant/message' ? 'assistant' : null
    if (!role || !roles.includes(role)) continue
    const content = role === 'user' ? event.data.content : event.data.message.content
    nonTextBlocks += content.filter((b) => b.type !== 'text' && b.type !== 'thinking' && b.type !== 'reasoning' && b.type !== 'tool-call').length
    const text = content.filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n')
    if (text) candidates.push({ seq: event.seq, time: event.time, role, text })
  }
  if (offset && (candidates[0]?.seq !== fromSeq || offset >= candidates[0].text.length)) throw new Error('续读 offset 与消息不匹配')
  const messages = []
  let remaining = maxChars, next = null
  const continuation = (seq, start) => ({ sessionId, fromSeq: seq, toSeq: upper, fromTime, toTime, roles, offset: start, limit, maxChars })
  for (const item of candidates) {
    const start = item.seq === fromSeq ? offset : 0
    if (messages.length >= limit || remaining < 2) { next = continuation(item.seq, start); break }
    let end = Math.min(item.text.length, start + remaining)
    // Keep UTF-16 surrogate pairs together at page boundaries.
    if (end < item.text.length && /[\uD800-\uDBFF]/.test(item.text[end - 1])) end--
    const text = item.text.slice(start, end)
    messages.push({ ...item, text, start, end, totalChars: item.text.length,
      source: { sessionId, seq: item.seq, label: `${sessionId} · ${item.role} · seq ${item.seq}`, text } })
    remaining -= text.length
    if (end < item.text.length) { next = continuation(item.seq, end); break }
  }
  return { sessionId, cwd: snapshot.session.cwd ?? null, sameWorkspace: snapshot.session.cwd != null && current?.header?.cwd != null && resolve(snapshot.session.cwd) === resolve(current.header.cwd),
    mode: 'original-conversation', capturedThroughSeq: upper, range: { fromSeq, toSeq: upper, fromTime, toTime },
    messages, nonTextBlocks, complete: next === null, next }
}
