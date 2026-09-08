/**
 * Shared client types + pure interaction decisions (unit-testable without DOM).
 */

import { nodeKind } from '../nodes.mjs'
export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'orange', 'purple', 'gray']

export const CARD_W = 260
export const CARD_H = 180
export const GRID = 24 // Shared visual and interaction grid, in canvas units.
export const Z_MIN = 0.2
export const Z_MAX = 3
export const WRITE_DEBOUNCE = 400

/** Canvas name rule — mirrors the host store's validation (spec §2.1 画布文件名). */
export const CANVAS_NAME_RE = /^[\w\u4e00-\u9fff-]+$/

export interface NbNote {
  version: string
  derivedFrom?: string[]
  file: string
  path: string
  id: string
  title: string
  color: string
  tags: string[]
  created: string
  source: { sessionId?: string | null; seq?: number | string | null; label?: string; text?: string; fragments?: SourceFragment[] } | null
  body: string
}
export interface NbNode {
  id: string
  type: string
  text?: string
  x: number
  y: number
  width: number
  height: number
  color?: string
  noteboard?: { kind: 'note' | 'text' | 'heading'; sourceTag?: string; fontSize?: number; color?: string }
}
export interface NbCanvas { nodes: NbNode[]; edges: unknown[]; groups: unknown[]; noteboard?: { suppressedTagHeadings?: string[] } }
export interface NbState {
  canvasVersion: string
  meta: { activeCanvas: string }
  canvases: string[]
  backups: Record<string, boolean>
  notes: NbNote[]
  canvas: NbCanvas
}
export interface SourceFragment { key: string; seq?: number; turn?: number; text: string; prefix: string; suffix: string; start: number; end: number }

/** Camera: board coordinates → screen via translate + scale (origin 0 0). */
export interface Camera { x: number; y: number; z: number }

/** 复位 camera: initial state and the toolbar reset target. */
export const RESET_CAM: Camera = { x: 200, y: 120, z: 1 }

export function clampZoom(z: number) {
  return Math.min(Z_MAX, Math.max(Z_MIN, z))
}

/** Zoom keeping the board point under the cursor fixed. */
export function zoomAt(cam: Camera, factor: number, cx: number, cy: number) {
  const z = clampZoom(cam.z * factor)
  const k = z / cam.z
  return {
    z,
    x: cx - (cx - cam.x) * k,
    y: cy - (cy - cam.y) * k,
  }
}

export function screenToBoard(cam: Camera, sx: number, sy: number) {
  return { x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z }
}

/** Padding kept between content and the viewport edge when framing (全览). */
export const FIT_PADDING = 48

/**
 * Camera that frames EVERY node (cards + tag titles) inside a viewport of
 * `vw × vh`, content centered. Fit never zooms in past 1× (a tiny board just
 * centers at 100%) and stays within the 0.2–3 range like any other zoom.
 * Empty board → same as 复位 (spec §3.1).
 */
export function fitCamera(nodes: NbNode[], vw: number, vh: number, padding = FIT_PADDING): Camera {
  if (!nodes || nodes.length === 0) return { ...RESET_CAM }
  const minX = Math.min(...nodes.map((n) => n.x))
  const minY = Math.min(...nodes.map((n) => n.y))
  const maxX = Math.max(...nodes.map((n) => n.x + (n.width || 0)))
  const maxY = Math.max(...nodes.map((n) => n.y + (n.height || 0)))
  const w = Math.max(maxX - minX, 1)
  const h = Math.max(maxY - minY, 1)
  const z = clampZoom(Math.min((vw - padding * 2) / w, (vh - padding * 2) / h, 1))
  return {
    z,
    x: vw / 2 - ((minX + maxX) / 2) * z,
    y: vh / 2 - ((minY + maxY) / 2) * z,
  }
}

/** Snap to the grid (拖动吸附, spec §3.1). */
export function snap(v: number, enabled = true) {
  return enabled ? Math.round(v / GRID) * GRID : v
}

export function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/** Marquee ⇄ node intersection (in board coordinates). */
export function marqueeHits(nodes: NbNode[], rect: { x: number; y: number; width: number; height: number }) {
  return nodes
    .filter((n) => ['note', 'text', 'heading'].includes(nodeKind(n)))
    .filter((n) => rectsOverlap(rect, { x: n.x, y: n.y, width: n.width, height: n.height }))
    .map((n) => n.id)
}

/**
 * Pure gesture decision for a pointerdown on the board background.
 * - tool 'pan'（空白拖拽平移 / 中键 / Space）
 * - tool 'marquee'（空白拖出选框）
 */
export function bgGesture({ button, spaceHeld }: { button: number; spaceHeld?: boolean }) {
  if (button === 1 || spaceHeld) return 'pan'
  return 'marquee'
}

/** Should a wheel event zoom (Ctrl/⌘+滚轮 / pinch) or pan? */
export function wheelAction(e: { ctrlKey?: boolean; metaKey?: boolean }, behavior = 'pan') {
  return e.ctrlKey || e.metaKey || behavior === 'zoom' ? 'zoom' : 'pan'
}

/**
 * Should the text-selection capture button appear for a selection inside
 * `target`? Non-conversation regions (settings, our own overlay, inputs)
 * never trigger it (spec §3.4).
 */
export function selectionCapturable(target: any) {
  if (!target || !target.closest) return false
  if (target.closest('.nb-overlay, .nb-card-menu, input, textarea, [contenteditable="true"]')) return false
  if (target.closest('[class*="settings"]')) return false
  // The conversation surface lives under the app's main region; require some
  // message/composer-ish ancestor so sidebars don't trigger capture either.
  return Boolean(
    target.closest('[class*="message"], [class*="markdown"], [class*="chat"], main'),
  )
}

/** Build the readable source label (spec §2.2 label,恒存降级展示). */
export function sourceLabel(workspaceName: string, sessionId?: string) {
  const ws = workspaceName || '工作区'
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const sess = sessionId ? `会话 ${String(sessionId).slice(0, 8)}` : '对话'
  return `${ws} / ${sess} · ${stamp}`
}

/** Note title from captured text: first line, truncated (spec §3.4). */
export function titleFromText(text: string) {
  const first = String(text ?? '').trim().split(/\r?\n/)[0] ?? ''
  const t = first.replace(/^#+\s*/, '').trim()
  return t.length > 20 ? `${t.slice(0, 20)}…` : t || '未命名'
}
