/**
 * Resolve the Session the main conversation area currently shows.
 *
 * dsh <= 0.1 exposed it as `sessions.list.current`; dsh 0.2 moved the main
 * binding to the `uiSession` service (`adapter.current`) and the list snapshot
 * no longer carries `current`. Read the new source first and keep the old one
 * as a fallback so both generations resolve the same session.
 */
export function currentSessionOf(sessions: any, ctx?: any) {
  const adapter = ctx?.get?.('uiSession')?.adapter
  const sessionId = adapter?.current?.getSnapshot?.()?.key ?? sessions?.list?.getSnapshot()?.current
  const row = sessionId ? sessions?.list?.getSnapshot()?.byId?.[sessionId] : undefined
  return { sessionId, cwd: row?.cwd, title: row?.title ?? row?.displayTitle ?? '' }
}
