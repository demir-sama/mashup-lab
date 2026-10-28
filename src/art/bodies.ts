import { INK } from '../core/palettes'
import { lGrad, vGrad, mix, lighten, darken, rgba, smoothClosed, roundedPoly, ellipse, inkStyle, TAU, rGrad, type Ctx, type Pt } from './draw'
import type { BodyInfo, Rig } from './rig'

const wob = (rig: Rig, i: number, amp = 1) => {
  const a = (1.1 + rig.wob * 5.5) * amp
  return { x: Math.sin(rig.t * 2.3 + i * 1.7) * a, y: Math.cos(rig.t * 1.9 + i * 2.3) * a * 0.8 }
}

function ring(rig: Rig, n: number, cx: number, cy: number, rx: number, ry: number, f: (th: number) => number, floorY = -3, amp = 1): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU - Math.PI / 2
    const r = f(th)
    const w = wob(rig, i, amp)
    out.push({ x: cx + Math.cos(th) * rx * r + w.x, y: Math.min(floorY, cy + Math.sin(th) * ry * r + w.y) })
  }
  return out
}

interface PaintOpts {
  cx: number
  cy: number
  rx: number
  ry: number
  belly?: boolean
  alpha?: number
  fillOverride?: string | CanvasGradient
  after?: (ctx: Ctx) => void
  outline?: number
  noPattern?: boolean
}

export function paintBody(ctx: Ctx, rig: Rig, path: Path2D, o: PaintOpts) {
  if (rig.dry) return
  const { pal } = rig
  const top = o.cy - o.ry
  const bot = o.cy + o.ry
  ctx.save()
  ctx.globalAlpha = o.alpha ?? 1
  ctx.fillStyle = o.fillOverride ?? vGrad(ctx, top, bot, [[0, pal.light], [0.35, pal.main], [1, mix(pal.main, pal.dark, 0.85)]])
  ctx.fill(path)
  ctx.save()
  ctx.clip(path)
  // belly
  if (o.belly) {
    ctx.fillStyle = rgba(pal.belly, 0.55)
    ctx.beginPath()
    ellipse(ctx, o.cx, o.cy + o.ry * 0.38, o.rx * 0.62, o.ry * 0.55)
    ctx.fill()
  }
  // pattern
  const pat = o.noPattern ? 0 : rig.g.pattern
  if (pat === 1) {
    ctx.fillStyle = rgba(pal.dark, 0.38)
    for (let i = 0; i < 7; i++) {
      const a = rig.rnd(i * 3) * TAU
      const d = 0.2 + rig.rnd(i * 3 + 1) * 0.7
      ctx.beginPath()
      ellipse(ctx, o.cx + Math.cos(a) * o.rx * d, o.cy + Math.sin(a) * o.ry * d, 7 + rig.rnd(i * 3 + 2) * 12, 6 + rig.rnd(i * 3 + 2) * 10)
      ctx.fill()
    }
  } else if (pat === 2) {
    ctx.strokeStyle = rgba(pal.dark, 0.36)
    ctx.lineWidth = 11
    ctx.lineCap = 'round'
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath()
      ctx.moveTo(o.cx + i * 22 - 28, bot + 6)
      ctx.quadraticCurveTo(o.cx + i * 22, o.cy, o.cx + i * 22 - 20, top - 6)
      ctx.stroke()
    }
  } else if (pat === 3) {
    ctx.fillStyle = rgba(pal.accent, 0.5)
    for (let i = 0; i < 3; i++) {
      const a = rig.rnd(i + 20) * TAU
      ctx.beginPath()
      ellipse(ctx, o.cx + Math.cos(a) * o.rx * 0.5, o.cy + Math.sin(a) * o.ry * 0.5, 22 + rig.rnd(i + 30) * 10, 17 + rig.rnd(i + 40) * 10, rig.rnd(i) * 3)
      ctx.fill()
    }
  }
  o.after?.(ctx)
  // shiny: a slow golden sheen sweeping across
  if (rig.g.shiny) {
    const sx = ((rig.t * 0.55) % 2.4) * 160 - 200
    const gg = ctx.createLinearGradient(sx - 40, o.cy - 60, sx + 40, o.cy + 60)
    gg.addColorStop(0, 'rgba(255,240,150,0)')
    gg.addColorStop(0.5, 'rgba(255,248,200,0.62)')
    gg.addColorStop(1, 'rgba(255,240,150,0)')
    ctx.fillStyle = gg
    ctx.fillRect(o.cx - 200, o.cy - 160, 400, 320)
  }
  // soft rim light, top-left
  ctx.strokeStyle = rgba('#ffffff', 0.38)
  ctx.lineWidth = 9
  ctx.translate(5, 6)
  ctx.stroke(path)
  ctx.translate(-5, -6)
  // glossy shine
  ctx.fillStyle = rgba('#ffffff', 0.36)
  ctx.beginPath()
  ellipse(ctx, o.cx - o.rx * 0.45, o.cy - o.ry * 0.45, o.rx * 0.17, o.ry * 0.1, -0.7)
  ctx.fill()
  // bottom shadow
  ctx.fillStyle = rgba(INK, 0.16)
  ctx.beginPath()
  ellipse(ctx, o.cx, bot + 2, o.rx * 1.2, o.ry * 0.28)
  ctx.fill()
  ctx.restore()
  ctx.globalAlpha = 1
  inkStyle(ctx, o.outline ?? 6.5)
  ctx.stroke(path)
  ctx.restore()
}

function info(path: Path2D, p: Partial<BodyInfo> & Pick<BodyInfo, 'top' | 'headY' | 'faceY' | 'faceW' | 'halfW' | 'midY'>): BodyInfo {
  return {
    path,
    shoulderY: p.midY - 12,
    shoulderX: p.halfW,
    hipY: -16,
    hipX: p.halfW * 0.45,
    floaty: false,
    bottom: 0,
    ...p,
  }
}

type BodyFn = (ctx: Ctx, rig: Rig) => BodyInfo

export const BODIES: Record<string, BodyFn> = {
  blob(ctx, rig) {
    const pts = ring(rig, 14, 0, -68, 76, 66, (th) => 1 + 0.07 * Math.sin(th * 3 + 1) + 0.05 * Math.sin(th * 5 + rig.rnd(1) * 6))
    const path = new Path2D()
    smoothClosed(path, pts)
    paintBody(ctx, rig, path, { cx: 0, cy: -68, rx: 76, ry: 66, belly: true })
    return info(path, { top: -134, headY: -122, faceY: -78, faceW: 104, halfW: 74, midY: -68, hipY: -14, hipX: 36 })
  },
  egg(ctx, rig) {
    const pts = ring(rig, 16, 0, -80, 64, 82, (th) => 1 + 0.2 * Math.max(0, Math.sin(th)) * 0 + 0, -3, 0.8)
    for (const p of pts) {
      const t = (p.y + 80) / 82 // -1 top .. 1 bottom
      p.x *= 1 + 0.16 * t
    }
    const path = new Path2D()
    smoothClosed(path, pts)
    paintBody(ctx, rig, path, { cx: 0, cy: -80, rx: 66, ry: 82, belly: true })
    return info(path, { top: -162, headY: -148, faceY: -104, faceW: 90, halfW: 68, midY: -70, shoulderY: -100, shoulderX: 60, hipY: -16, hipX: 36 })
  },
  gourd(ctx, rig) {
    const pts = ring(rig, 28, 0, -58, 98, 58, (th) => 1 + 0.045 * Math.cos(th * 7), -3, 0.8)
    const path = new Path2D()
    smoothClosed(path, pts)
    paintBody(ctx, rig, path, {
      cx: 0, cy: -58, rx: 98, ry: 58, belly: false,
      after: (c) => {
        c.strokeStyle = rgba(rig.pal.dark, 0.5)
        c.lineWidth = 5
        c.lineCap = 'round'
        for (const k of [-0.6, -0.3, 0.3, 0.6]) {
          c.beginPath()
          c.moveTo(k * 100 * 0.45, -112)
          c.quadraticCurveTo(k * 100 * 1.3, -58, k * 100 * 0.45, -4)
          c.stroke()
        }
        c.beginPath()
        c.moveTo(0, -112)
        c.quadraticCurveTo(0, -58, 0, -4)
        c.stroke()
      },
    })
    if (rig.dry) return info(path, { top: -116, headY: -102, faceY: -64, faceW: 130, halfW: 96, midY: -58, shoulderY: -66, shoulderX: 92, hipY: -12, hipX: 50 })
    // stem
    ctx.save()
    ctx.beginPath()
    roundedPoly(ctx, [{ x: -9, y: -112 }, { x: 9, y: -112 }, { x: 13, y: -134 }, { x: -3, y: -138 }], 4)
    ctx.fillStyle = '#6aa11d'
    ctx.fill()
    inkStyle(ctx, 5)
    ctx.stroke()
    ctx.restore()
    return info(path, { top: -116, headY: -102, faceY: -64, faceW: 130, halfW: 96, midY: -58, shoulderY: -66, shoulderX: 92, hipY: -12, hipX: 50 })
  },
  sheet(ctx, rig) {
    const w = 64
    const pts: Pt[] = []
    const n = 9
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI
      const j = wob(rig, i, 0.8)
      pts.push({ x: Math.cos(a) * w + j.x, y: -112 + Math.sin(a) * 66 + j.y })
    }
    // right side down + wavy hem back to the left
    const hem = 7
    for (let i = 0; i <= hem; i++) {
      const x = w - (i / hem) * 2 * w
      const wave = Math.sin(rig.t * 3 + i * 1.4) * (3 + rig.wob * 5)
      pts.push({ x: i === 0 ? w + 3 : i === hem ? -w - 3 : x, y: i % 2 === 0 ? -20 + wave : -42 + wave })
    }
    pts.splice(n + 1, 0, { x: w + 4, y: -80 })
    pts.push({ x: -w - 4, y: -80 })
    const path = new Path2D()
    smoothClosed(path, pts, 0.85)
    paintBody(ctx, rig, path, { cx: 0, cy: -92, rx: 66, ry: 78, belly: false, fillOverride: vGrad(ctx, -178, -12, [[0, lighten(rig.pal.belly, 0.2)], [0.5, rig.pal.light], [1, mix(rig.pal.main, rig.pal.light, 0.35)]]) })
    return info(path, { top: -178, headY: -160, faceY: -112, faceW: 94, halfW: 66, midY: -100, shoulderY: -100, shoulderX: 62, hipY: -26, hipX: 30, floaty: true, bottom: -20 })
  },
  puff(ctx, rig) {
    const pts: Pt[] = []
    const n = 44
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU
      const r = (i % 2 ? 1.1 : 0.96) * (1 + 0.05 * Math.sin(th * 3)) * 1
      const j = wob(rig, i, 0.35)
      pts.push({ x: Math.cos(th) * 74 * r + j.x, y: Math.min(-3, -68 + Math.sin(th) * 68 * r + j.y) })
    }
    const path = new Path2D()
    roundedPoly(path, pts, 5)
    paintBody(ctx, rig, path, { cx: 0, cy: -68, rx: 76, ry: 68, belly: true, outline: 5.5 })
    return info(path, { top: -138, headY: -124, faceY: -80, faceW: 100, halfW: 76, midY: -68, hipY: -14, hipX: 34 })
  },
  tower(ctx, rig) {
    const j = (i: number) => wob(rig, i, 0.5)
    const base: Pt[] = [{ x: -30, y: -176 }, { x: 30, y: -176 }, { x: 64, y: -124 }, { x: 48, y: -5 }, { x: -48, y: -5 }, { x: -64, y: -124 }]
    const pts = base.map((p, i) => ({ x: p.x + j(i).x, y: p.y + j(i).y * (p.y > -10 ? 0 : 1) }))
    const path = new Path2D()
    roundedPoly(path, pts, 14)
    paintBody(ctx, rig, path, {
      cx: 0, cy: -90, rx: 64, ry: 88, belly: false,
      after: (c) => {
        // coffin lid cross + plank lines
        c.strokeStyle = rgba(INK, 0.22)
        c.lineWidth = 5
        c.lineCap = 'round'
        c.beginPath()
        c.moveTo(0, -150); c.lineTo(0, -108)
        c.moveTo(-14, -136); c.lineTo(14, -136)
        c.moveTo(-40, -28); c.lineTo(40, -28)
        c.stroke()
      },
    })
    return info(path, { top: -176, headY: -164, faceY: -118, faceW: 84, halfW: 56, midY: -90, shoulderY: -122, shoulderX: 62, hipY: -14, hipX: 28 })
  },
  jelly(ctx, rig) {
    const w = 70
    const pts: Pt[] = [{ x: -w, y: -134 }, { x: w, y: -134 }, { x: w + 4, y: -4 }, { x: -w - 4, y: -4 }]
    const out: Pt[] = []
    const seg = (a: Pt, b: Pt, k: number, i0: number) => {
      for (let i = 0; i < k; i++) {
        const t = i / k
        const jw = wob(rig, i0 + i, 1.6)
        out.push({ x: a.x + (b.x - a.x) * t + jw.x, y: Math.min(-4, a.y + (b.y - a.y) * t + jw.y) })
      }
    }
    for (let i = 0; i < 4; i++) seg(pts[i], pts[(i + 1) % 4], 3, i * 3)
    const path = new Path2D()
    smoothClosed(path, out, 0.9)
    paintBody(ctx, rig, path, {
      cx: 0, cy: -69, rx: 72, ry: 66, alpha: 0.82, belly: false,
      after: (c) => {
        // inner nucleus + bubbles
        c.fillStyle = rgba(rig.pal.dark, 0.35)
        c.beginPath()
        ellipse(c, Math.sin(rig.t * 1.4) * 8, -50 + Math.cos(rig.t * 1.2) * 5, 26, 22)
        c.fill()
        c.fillStyle = rgba('#ffffff', 0.45)
        for (let i = 0; i < 5; i++) {
          const bx = -40 + rig.rnd(i + 5) * 80
          const by = -20 - ((rig.t * 12 + rig.rnd(i) * 100) % 100)
          c.beginPath()
          ellipse(c, bx, by, 3 + rig.rnd(i + 9) * 4, 3 + rig.rnd(i + 9) * 4)
          c.fill()
        }
      },
    })
    return info(path, { top: -138, headY: -126, faceY: -82, faceW: 108, halfW: 70, midY: -70, hipY: -14, hipX: 38 })
  },
  patch(ctx, rig) {
    const pts: Pt[] = [{ x: -62, y: -134 }, { x: 60, y: -138 }, { x: 76, y: -80 }, { x: 62, y: -6 }, { x: -62, y: -4 }, { x: -76, y: -76 }]
    const q = pts.map((p, i) => ({ x: p.x + wob(rig, i, 0.6).x, y: p.y + (p.y > -10 ? 0 : wob(rig, i, 0.6).y) }))
    const path = new Path2D()
    roundedPoly(path, q, 22)
    paintBody(ctx, rig, path, {
      cx: 0, cy: -70, rx: 76, ry: 68, belly: false,
      after: (c) => {
        const cols = [rig.pal.accent, rig.pal.dark, rig.pal.light]
        const rects: [number, number, number, number][] = [[-80, -140, 70, 60], [14, -92, 70, 56], [-80, -40, 60, 40]]
        rects.forEach((r, i) => {
          c.fillStyle = rgba(cols[i % 3], 0.55)
          c.fillRect(r[0], r[1], r[2], r[3])
        })
        // stitches
        c.strokeStyle = rgba(INK, 0.7)
        c.lineWidth = 3
        c.setLineDash([8, 7])
        c.beginPath()
        c.moveTo(-10, -140); c.lineTo(-10, -80); c.lineTo(80, -80)
        c.moveTo(14, -92); c.lineTo(14, 0)
        c.moveTo(-80, -40); c.lineTo(-20, -40); c.lineTo(-20, 0)
        c.stroke()
        c.setLineDash([])
        // button
        c.fillStyle = '#ffe08a'
        c.beginPath(); ellipse(c, 40, -30, 8, 8); c.fill()
        c.strokeStyle = INK; c.lineWidth = 3; c.stroke()
      },
    })
    return info(path, { top: -138, headY: -126, faceY: -88, faceW: 112, halfW: 76, midY: -70, hipY: -14, hipX: 38 })
  },
}

export function drawBody(ctx: Ctx, rig: Rig, id: string): BodyInfo {
  return (BODIES[id] ?? BODIES.blob)(ctx, rig)
}
void lGrad
void darken
void rGrad
