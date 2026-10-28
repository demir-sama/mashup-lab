import { INK } from '../core/palettes'

export type Ctx = CanvasRenderingContext2D
export interface Pt {
  x: number
  y: number
}

export const TAU = Math.PI * 2

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const clamp8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => clamp8(v).toString(16).padStart(2, '0')).join('')
}
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}
export const lighten = (c: string, t: number) => mix(c, '#ffffff', t)
export const darken = (c: string, t: number) => mix(c, INK, t)
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

/** Append a smooth closed Catmull-Rom curve through pts to the current path. */
export function smoothClosed(ctx: Ctx | Path2D, pts: Pt[], k = 1) {
  const n = pts.length
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    ctx.bezierCurveTo(
      p1.x + ((p2.x - p0.x) / 6) * k,
      p1.y + ((p2.y - p0.y) / 6) * k,
      p2.x - ((p3.x - p1.x) / 6) * k,
      p2.y - ((p3.y - p1.y) / 6) * k,
      p2.x,
      p2.y,
    )
  }
  ctx.closePath()
}

export function smoothOpen(ctx: Ctx | Path2D, pts: Pt[], move = true) {
  const n = pts.length
  if (move) ctx.moveTo(pts[0].x, pts[0].y)
  else ctx.lineTo(pts[0].x, pts[0].y)
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(n - 1, i + 2)]
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6,
      p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6,
      p2.y - (p3.y - p1.y) / 6,
      p2.x,
      p2.y,
    )
  }
}

/** Polygon with rounded corners. */
export function roundedPoly(ctx: Ctx | Path2D, pts: Pt[], r: number) {
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y)
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    const rr = Math.min(r, d1 / 2, d2 / 2)
    const a = { x: p1.x + ((p0.x - p1.x) / d1) * rr, y: p1.y + ((p0.y - p1.y) / d1) * rr }
    const b = { x: p1.x + ((p2.x - p1.x) / d2) * rr, y: p1.y + ((p2.y - p1.y) / d2) * rr }
    if (i === 0) ctx.moveTo(a.x, a.y)
    else ctx.lineTo(a.x, a.y)
    ctx.quadraticCurveTo(p1.x, p1.y, b.x, b.y)
  }
  ctx.closePath()
}

export function ellipse(ctx: Ctx | Path2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot))
  ;(ctx as Ctx).ellipse(x, y, rx, ry, rot, 0, TAU)
}

export function inkStyle(ctx: Ctx, w = 6) {
  ctx.strokeStyle = INK
  ctx.lineWidth = w
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
}

/** Fill the current path then draw the thick cartoon outline. */
export function fillInk(ctx: Ctx, fill: string | CanvasGradient | CanvasPattern, w = 6, path?: Path2D) {
  ctx.fillStyle = fill
  inkStyle(ctx, w)
  if (path) {
    ctx.fill(path)
    ctx.stroke(path)
  } else {
    ctx.fill()
    ctx.stroke()
  }
}

export function vGrad(ctx: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}
export function lGrad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}
export function rGrad(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}

/** Cartoon tube: thick line through points with ink outline. */
export function tube(ctx: Ctx, pts: Pt[], th: number, col: string, outline = 6) {
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  smoothOpen(ctx, pts)
  ctx.strokeStyle = INK
  ctx.lineWidth = th + outline * 2
  ctx.stroke()
  ctx.strokeStyle = col
  ctx.lineWidth = th
  ctx.stroke()
  ctx.strokeStyle = rgba('#ffffff', 0.28)
  ctx.lineWidth = th * 0.28
  ctx.translate(-th * 0.15, -th * 0.18)
  ctx.beginPath()
  smoothOpen(ctx, pts)
  ctx.stroke()
  ctx.restore()
}

/** Closed outline of a tapering ribbon around a spine. */
export function taperPath(spine: Pt[], w0: number, w1: number): Pt[] {
  const left: Pt[] = []
  const right: Pt[] = []
  const n = spine.length
  for (let i = 0; i < n; i++) {
    const a = spine[Math.max(0, i - 1)]
    const b = spine[Math.min(n - 1, i + 1)]
    let dx = b.x - a.x
    let dy = b.y - a.y
    const d = Math.hypot(dx, dy) || 1
    dx /= d
    dy /= d
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2
    left.push({ x: spine[i].x - dy * w, y: spine[i].y + dx * w })
    right.push({ x: spine[i].x + dy * w, y: spine[i].y - dx * w })
  }
  return [...left, ...right.reverse()]
}

export function star4(ctx: Ctx | Path2D, x: number, y: number, r: number, inner = 0.3) {
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * inner
    const a = (i * Math.PI) / 4
    const px = x + Math.sin(a) * rad
    const py = y - Math.cos(a) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

export function bezierPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}
export function bezierSpine(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < n; i++) out.push(bezierPoint(p0, p1, p2, p3, i / (n - 1)))
  return out
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
