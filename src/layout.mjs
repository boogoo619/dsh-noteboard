/**
 * Tag rearrange layout (spec §3.3 / decision #15) and placement helpers.
 *
 * Algorithm:
 * 1. Each tag is a cluster; notes with multiple tags join their FIRST tag;
 *    untagged notes go to the rightmost 未分类 cluster.
 * 2. Inside a cluster: fixed-card grid, columns = ⌈√n⌉, so clusters approach
 *    square; a tag title row sits on top of each cluster.
 * 3. Clusters sorted by note count (desc), then shelf-packed left→right,
 *    wrapping when they exceed the converged board width.
 *
 * Pure functions — unit-testable without fs.
 */

import { CARD_W, CARD_H, COLOR_TO_CANVAS } from './store.mjs'

export const GRID_GAP = 24 // gap between cards inside a cluster
export const TITLE_H = 40 // tag title strip height
export const CLUSTER_GAP = 96 // aisle between clusters

const UNCATEGORIZED = '未分类'

/** One cluster's grid: returns { width, height, cards: [{note, x, y}] } relative to origin. */
function buildCluster(tag, notes) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(notes.length)))
  const stepX = CARD_W + GRID_GAP
  const stepY = CARD_H + GRID_GAP
  const cards = notes.map((note, i) => ({
    note,
    x: (i % cols) * stepX,
    y: TITLE_H + Math.floor(i / cols) * stepY,
  }))
  const width = Math.max(0, cols * stepX - GRID_GAP)
  const rows = Math.ceil(notes.length / cols)
  const height = TITLE_H + Math.max(0, rows * stepY - GRID_GAP)
  return { tag, width, height, cards }
}

/**
 * Build the rearranged node list for a set of notes.
 * Returns JSON Canvas `nodes` (text title nodes + note nodes), ready to write.
 */
export function rearrangeNodes(notes, { headings = true, suppressed = [] } = {}) {
  // 1. Assign notes to clusters (first tag wins; untagged → 未分类).
  const byTag = new Map()
  for (const note of notes) {
    const tag = note.tags.length > 0 ? note.tags[0] : UNCATEGORIZED
    if (!byTag.has(tag)) byTag.set(tag, [])
    byTag.get(tag).push(note)
  }
  if (byTag.size === 0) return []

  // 2. Build clusters, sorted by size desc; 未分类 always rightmost.
  const clusters = [...byTag.entries()]
    .map(([tag, list]) => buildCluster(tag, list))
    .sort((a, b) => {
      if (a.tag === UNCATEGORIZED) return 1
      if (b.tag === UNCATEGORIZED) return -1
      return b.cards.length - a.cards.length
    })

  // 3. Shelf-pack: converge on a board width ≈ square of the total area.
  const totalW = clusters.reduce((s, c) => s + c.width + CLUSTER_GAP, 0) - CLUSTER_GAP
  const totalCells = notes.length + clusters.length
  const cell = CARD_W + GRID_GAP
  const boardWidth = Math.max(
    Math.max(...clusters.map((c) => c.width)),
    Math.round(Math.sqrt(totalCells) * cell),
    Math.min(totalW, 4 * cell * 4), // don't collapse to one skinny column
  )

  const nodes = []
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0
  for (const cluster of clusters) {
    if (cursorX > 0 && cursorX + cluster.width > boardWidth) {
      cursorX = 0
      cursorY += rowHeight + CLUSTER_GAP
      rowHeight = 0
    }
    // Tag title (plain JSON Canvas text node — format-native, zero migration).
    if (headings && !suppressed.includes(cluster.tag)) nodes.push({
      id: `tag:${cluster.tag}`,
      type: 'text',
      text: cluster.tag,
      noteboard: { kind: 'heading', sourceTag: cluster.tag, fontSize: 14 },
      x: cursorX,
      y: cursorY,
      width: Math.max(cluster.width, CARD_W),
      height: TITLE_H,
      color: COLOR_TO_CANVAS.purple ?? undefined,
    })
    for (const { note, x, y } of cluster.cards) {
      const ref = (note.file ?? note.path ?? `${note.id}.md`).replace(/\.md$/, '')
      nodes.push({
        id: note.id,
        type: 'text',
        text: `[[.noteboard/notes/${ref}]]`,
        x: cursorX + x,
        y: cursorY + y,
        width: CARD_W,
        height: CARD_H,
        color: COLOR_TO_CANVAS[note.color] ?? undefined,
        noteboard: { kind: 'note' },
      })
    }
    cursorX += cluster.width + CLUSTER_GAP
    rowHeight = Math.max(rowHeight, cluster.height)
  }
  return nodes
}
