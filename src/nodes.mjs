export function nodeKind(node) {
  if (node.noteboard?.kind) return node.noteboard.kind
  if (String(node.id).startsWith('tag:')) return 'heading'
  if (!node.text || /^\[\[\.noteboard\/notes\/[^\n]+\]\]$/.test(node.text)) return 'note'
  return node.type === 'text' ? 'text' : 'unknown'
}
export function nodeText(node) {
  return nodeKind(node) === 'heading' && !node.noteboard ? (node.text ?? '').replace(/^#\s*/, '') : node.text ?? ''
}
export function headingTag(node) { return node.noteboard?.sourceTag ?? String(node.id).slice(4) }
export function normalizeNode(node) {
  const kind = nodeKind(node)
  if (kind === 'unknown') return node
  return { ...node, text: nodeText(node), noteboard: { ...node.noteboard, kind, ...(kind === 'heading' ? { sourceTag: headingTag(node) } : {}), ...(kind !== 'note' ? { fontSize: node.noteboard?.fontSize ?? (kind === 'heading' ? 14 : 20) } : {}) } }
}
export function suppressHeading(canvas, node) {
  const suppressed = new Set(canvas.noteboard?.suppressedTagHeadings ?? [])
  suppressed.add(headingTag(node))
  canvas.noteboard = { ...canvas.noteboard, suppressedTagHeadings: [...suppressed] }
}
export function detachHeading(canvas, node) {
  const next = normalizeNode(node)
  if (nodeKind(node) !== 'heading') return next
  suppressHeading(canvas, node)
  return { ...next, noteboard: { ...next.noteboard, kind: 'text' } }
}
// A manual layout write transfers moved/edited headings to user ownership.
export function applyManualNodes(canvas, nodes) {
  const before = new Map(canvas.nodes.map((node) => [node.id, node]))
  const ids = new Set(nodes.map((node) => node.id))
  for (const old of canvas.nodes) if (!ids.has(old.id) && nodeKind(old) === 'heading') suppressHeading(canvas, old)
  return nodes.map((node) => {
    const old = before.get(node.id)
    if (old && nodeKind(old) === 'heading' && (node.x !== old.x || node.y !== old.y || node.width !== old.width || nodeText(node) !== nodeText(old) || node.color !== old.color || node.noteboard?.color !== old.noteboard?.color || (node.noteboard?.fontSize ?? 14) !== (old.noteboard?.fontSize ?? 14))) {
      return detachHeading(canvas, node)
    }
    return normalizeNode(node)
  })
}
