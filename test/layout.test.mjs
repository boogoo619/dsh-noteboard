import { describe, it, expect } from 'vitest'
import { rearrangeNodes, orderedNodes } from '../src/layout.mjs'

const note = (id, tags, color = 'yellow') => ({
  id, tags, color, path: `.noteboard/notes/x-${id}.md`,
})

describe('orderedNodes', () => {
  const nodes = [
    { id: 'later', x: 500, y: 300, width: 120, height: 90, color: '5', custom: { keep: true } },
    { id: 'earlier', x: 100, y: 100, width: 300, height: 160, color: '4' },
    { id: 'latest', x: 800, y: 500, width: 200, height: 100 },
  ]
  it('preserves explicit order and variable dimensions in a row-major grid', () => {
    const input = structuredClone(nodes)
    const placed = orderedNodes(nodes, [], 2)
    expect(placed.map((n) => n.id)).toEqual(nodes.map((n) => n.id))
    expect(placed.map(({ x, y }) => [x, y])).toEqual([[100, 100], [424, 100], [100, 284]])
    expect(placed.map(({ x, y, ...rest }) => rest)).toEqual(nodes.map(({ x, y, ...rest }) => rest))
    expect(nodes).toEqual(input)
  })
  it('supports a vertical timeline and shifts the whole grid around retained objects', () => {
    const retained = [{ id: 'text', x: 90, y: 100, width: 600, height: 500 }]
    const placed = orderedNodes(nodes, retained, 1)
    expect(placed.every((n) => n.x > retained[0].x + retained[0].width)).toBe(true)
    expect(new Set(placed.map((n) => n.x)).size).toBe(1)
    expect(placed.map((n) => n.y)).toEqual([100, 284, 468])
    expect(retained[0].x).toBe(90)
  })
  it('handles a single note and rejects invalid column counts', () => {
    expect(orderedNodes([nodes[0]], [])).toEqual([nodes[0]])
    for (const columns of [0, -1, 1.5, 201, NaN, '2', null]) expect(() => orderedNodes(nodes, [], columns)).toThrow('整数')
  })
})

describe('rearrangeNodes', () => {
  it('produces tag title text nodes + note nodes', () => {
    const nodes = rearrangeNodes([note('a1', ['增长']), note('a2', ['增长']), note('a3', [])])
    const titles = nodes.filter((n) => String(n.id).startsWith('tag:'))
    expect(titles.map((t) => t.id).sort()).toEqual(['tag:增长', 'tag:未分类'].sort())
    expect(nodes.filter((n) => n.id === 'a1')).toHaveLength(1)
    expect(nodes.every((n) => n.type === 'text')).toBe(true)
  })

  it('multi-tag notes join their FIRST tag', () => {
    const nodes = rearrangeNodes([note('m1', ['灵感', '增长']), note('m2', ['灵感'])])
    const title = nodes.find((n) => n.id === 'tag:灵感')
    const members = nodes.filter((n) => ['m1', 'm2'].includes(n.id))
    // both under the same cluster → same y band as the 灵感 title
    expect(members.every((m) => m.y >= title.y)).toBe(true)
    expect(nodes.some((n) => n.id === 'tag:增长')).toBe(false)
  })

  it('clusters approach square: cols = ⌈√n⌉', () => {
    const n = 7 // ⌈√7⌉ = 3 cols → rows = 3
    const nodes = rearrangeNodes(Array.from({ length: n }, (_, i) => note(`s${i}`, ['k'])))
    const xs = new Set(nodes.filter((x) => x.id.startsWith('s')).map((x) => x.x))
    const ys = new Set(nodes.filter((x) => x.id.startsWith('s')).map((x) => x.y))
    expect(xs.size).toBeLessThanOrEqual(3)
    expect(ys.size).toBeLessThanOrEqual(3)
  })

  it('sorts clusters by size desc and puts 未分类 rightmost', () => {
    const notes = [
      note('u1', []), note('u2', []),
      ...Array.from({ length: 5 }, (_, i) => note(`b${i}`, ['big'])),
      note('s1', ['small']),
    ]
    const nodes = rearrangeNodes(notes)
    const xOf = (id) => nodes.find((n) => n.id === id)?.x
    expect(xOf('tag:big')).toBeLessThan(xOf('tag:small'))
    expect(xOf('tag:small')).toBeLessThan(xOf('tag:未分类'))
  })

  it('empty input → no nodes', () => {
    expect(rearrangeNodes([])).toEqual([])
  })
})
