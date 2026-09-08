import { describe, it, expect } from 'vitest'
import { rearrangeNodes } from '../src/layout.mjs'

const note = (id, tags, color = 'yellow') => ({
  id, tags, color, path: `.noteboard/notes/x-${id}.md`,
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
