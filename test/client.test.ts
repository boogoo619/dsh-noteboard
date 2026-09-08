import { describe, it, expect } from 'vitest'
import { renderMarkdown, escapeHtml } from '../dsh-noteboard/src/client/markdown'
import {
  zoomAt, clampZoom, marqueeHits, selectionCapturable, titleFromText, snap, bgGesture, wheelAction, fitCamera,
} from '../dsh-noteboard/src/client/types'
import { parseDistillResult, distillPrompt } from '../src/distill.mjs'

describe('markdown (restricted card render)', () => {
  it('escapes html', () => {
    expect(escapeHtml('<img>')).toBe('&lt;img&gt;')
    expect(renderMarkdown('<script>x</script>')).not.toContain('<script>')
  })
  it('renders bold/italic/code/list restricted', () => {
    const html = renderMarkdown('**b** and *i* and `c`\n\n- item1\n- item2')
    expect(html).toContain('<strong>b</strong>')
    expect(html).toContain('<em>i</em>')
    expect(html).toContain('<code>c</code>')
    expect(html).toContain('<li>item1</li>')
  })
  it('card mode hides headings/links; full mode renders them', () => {
    const src = '# 标题\n[例](https://x.io)'
    expect(renderMarkdown(src)).not.toContain('<h1')
    expect(renderMarkdown(src, { full: true })).toContain('<h1>')
    expect(renderMarkdown(src, { full: true })).toContain('href="https://x.io"')
  })
  it('renders fenced code', () => {
    expect(renderMarkdown('```\na<b\n```')).toContain('<pre><code>')
  })
})

describe('camera / gestures', () => {
  it('clamps zoom to 0.2–3', () => {
    expect(clampZoom(0.01)).toBe(0.2)
    expect(clampZoom(9)).toBe(3)
  })
  it('zoomAt keeps the cursor point fixed', () => {
    const cam = { x: 100, y: 50, z: 1 }
    const next = zoomAt(cam, 1.25, 300, 200)
    const p1 = { x: (300 - cam.x) / cam.z, y: (200 - cam.y) / cam.z }
    const p2 = { x: (300 - next.x) / next.z, y: (200 - next.y) / next.z }
    expect(p2.x).toBeCloseTo(p1.x, 6)
    expect(p2.y).toBeCloseTo(p1.y, 6)
  })
  it('uses the visual grid and supports unsnapped movement', () => {
    expect(snap(13)).toBe(24)
    expect(snap(13.5, false)).toBe(13.5)
    const delta = snap(31)
    expect((75 + delta) - (11 + delta)).toBe(64)
    expect(wheelAction({}, 'zoom')).toBe('zoom')
    expect(wheelAction({ ctrlKey: true }, 'pan')).toBe('zoom')
  })
  it('blank gesture: middle/space pans, default marquees', () => {
    expect(bgGesture({ button: 1 })).toBe('pan')
    expect(bgGesture({ button: 0, spaceHeld: true })).toBe('pan')
    expect(bgGesture({ button: 0, spaceHeld: false })).toBe('marquee')
  })
  it('ctrl/⌘+wheel zooms, plain wheel pans', () => {
    expect(wheelAction({ ctrlKey: true, metaKey: false })).toBe('zoom')
    expect(wheelAction({ ctrlKey: false, metaKey: true })).toBe('zoom')
    expect(wheelAction({ ctrlKey: false, metaKey: false })).toBe('pan')
  })
  it('marquee includes notes, headings and free text inside the rect', () => {
    const nodes = [
      { id: 'a', type: 'text', x: 0, y: 0, width: 100, height: 100 },
      { id: 'tag:t', type: 'text', x: 0, y: 0, width: 100, height: 40 },
      { id: 'text:t', type: 'text', text: 'caption', x: 10, y: 10, width: 100, height: 40 },
      { id: 'b', type: 'text', x: 500, y: 500, width: 100, height: 100 },
    ]
    expect(marqueeHits(nodes, { x: -10, y: -10, width: 120, height: 120 })).toEqual(['a', 'tag:t', 'text:t'])
  })
  it('fitCamera frames every node inside the viewport, centered', () => {
    const nodes = [
      { id: 'tag:t', type: 'text', x: 0, y: 0, width: 500, height: 40 },
      { id: 'a', type: 'text', x: 0, y: 40, width: 260, height: 180 },
      { id: 'b', type: 'text', x: 1000, y: 800, width: 260, height: 180 },
    ]
    const cam = fitCamera(nodes, 800, 600)
    const px = (x) => cam.x + x * cam.z
    const py = (y) => cam.y + y * cam.z
    // all edges land inside the viewport, clear of the padding-free borders
    expect(px(0)).toBeGreaterThanOrEqual(0)
    expect(px(1260)).toBeLessThanOrEqual(800)
    expect(py(0)).toBeGreaterThanOrEqual(0)
    expect(py(980)).toBeLessThanOrEqual(600)
    // content is centered on both axes
    expect((px(0) + px(1260)) / 2).toBeCloseTo(400, 6)
    expect((py(0) + py(980)) / 2).toBeCloseTo(300, 6)
  })
  it('fitCamera never zooms in past 1×; empty board resets', () => {
    const tiny = [{ id: 'a', type: 'text', x: 10, y: 10, width: 260, height: 180 }]
    const cam = fitCamera(tiny, 1200, 800)
    expect(cam.z).toBe(1)
    expect(fitCamera([], 800, 600)).toEqual({ x: 200, y: 120, z: 1 })
  })
  it('fitCamera clamps to Z_MIN when the board cannot fit', () => {
    const huge = [
      { id: 'a', type: 'text', x: 0, y: 0, width: 260, height: 180 },
      { id: 'b', type: 'text', x: 20000, y: 16000, width: 260, height: 180 },
    ]
    expect(fitCamera(huge, 800, 600).z).toBe(0.2)
  })
})

describe('capture heuristics', () => {
  const el = (hits) => ({
    closest: (sel) => (Object.keys(hits).some((k) => sel.includes(k)) ? hits : null),
  })
  it('ignores our overlay, inputs and settings', () => {
    expect(selectionCapturable(el({ '.nb-overlay': true }))).toBe(false)
    expect(selectionCapturable(el({ input: true }))).toBe(false)
    expect(selectionCapturable(el({ '[class*="settings"]': true }))).toBe(false)
    expect(selectionCapturable(null)).toBe(false)
  })
  it('accepts message-ish regions', () => {
    expect(selectionCapturable(el({ '[class*="markdown"]': true }))).toBe(true)
  })
  it('title from first line truncated', () => {
    expect(titleFromText('# 增长思路\n正文')).toBe('增长思路')
    expect(titleFromText('x'.repeat(40))).toBe(`${'x'.repeat(20)}…`)
    expect(titleFromText('')).toBe('未命名')
  })
})

describe('distill', () => {
  it('parses fenced JSON', () => {
    const r = parseDistillResult('```json\n{"title":"T","tags":["a","b"],"body":"B"}\n```')
    expect(r).toEqual({ title: 'T', tags: ['a', 'b'], body: 'B' })
  })
  it('parses embedded JSON with surrounding text', () => {
    expect(parseDistillResult('好的：{"title":"标题","tags":[],"body":""} 完成以上')).toEqual({ title: '标题', tags: [], body: '' })
  })
  it('rejects garbage; never silent-retries', () => {
    expect(parseDistillResult('no json here')).toBeNull()
    expect(parseDistillResult('{"tags":[]}')).toBeNull()
  })
  it('prompt asks for JSON only', () => {
    expect(distillPrompt('文本')).toContain('JSON')
    expect(distillPrompt('文本')).toContain('文本')
  })
})

describe('distill v2 (settings-aware parsing)', () => {
  const { parseDistillResult, stripThinking, distillPrompt } = require('../src/distill.mjs')
  it('strips complete and unterminated think blocks', () => {
    expect(stripThinking('<think>let me {think "x"}</think>{"title":"T"}')).toBe('{"title":"T"}')
    expect(stripThinking('<think>reasoning {"a":1}')).toBe('')
  })
  it('parses fenced JSON after thinking', () => {
    const r = parseDistillResult('<think>分析一下… {"title":"错"} 这不是答案</think>\n```json\n{"title":"对","tags":["a"],"body":"B"}\n```')
    expect(r?.title).toBe('对')
  })
  it('parses first balanced object with braces inside strings', () => {
    const r = parseDistillResult('前言 {"title":"T","tags":[],"body":"包含 } 与 \\" 引号"} 后记')
    expect(r?.body).toContain('}')
  })
  it('prefers fence over earlier broken objects', () => {
    const r = parseDistillResult('{bad json} ```json\n{"title":"W","tags":[],"body":""}\n```')
    expect(r?.title).toBe('W')
  })
  it('additional requirements preserve the built-in output contract', () => {
    const prompt = distillPrompt('文本', { distillInstructions: '保留关键数字' })
    expect(prompt).toContain('保留关键数字')
    expect(prompt).toContain('JSON')
    expect(distillPrompt('文本', { prompt: '旧指令' })).not.toContain('旧指令')
  })
})
