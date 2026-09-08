export type Reply = { turn: number; text: string }

/** Baseline the loaded history; only new, successful turn completions can notify. */
export function createReplyTracker(initial: any, activatedAt: number) {
  let highWater = 0
  const seen = new Set<number>()
  for (const turn of initial?.timeline?.turns?.values() ?? []) {
    highWater = Math.max(highWater, turn.start?.seq ?? 0, turn.end?.seq ?? 0)
    if (turn.end) seen.add(turn.turn)
  }
  return (snapshot: any): Reply | null => {
    let latest: Reply | null = null
    const turns = [...(snapshot?.timeline?.turns?.values() ?? [])].sort((a: any, b: any) => (a.end?.seq ?? 0) - (b.end?.seq ?? 0)) as any[]
    for (const turn of turns) {
      const end = turn.end
      if (!end || seen.has(turn.turn)) continue
      seen.add(turn.turn)
      if (end.seq <= highWater || end.time < activatedAt) continue
      highWater = end.seq
      if (end.data?.reason?.kind !== 'completed') continue
      const closing = turn.data?.get('turn-tail')?.closing
      if (closing?.status !== 'settled') continue
      const text = closing.blocks.filter((b: any) => b.kind === 'text').map((b: any) => b.text).join('\n\n').trim()
      if (text) latest = { turn: turn.turn, text }
    }
    return latest
  }
}
