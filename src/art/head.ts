import { INK } from '../core/palettes'
import { mix, lighten, rgba, smoothClosed, roundedPoly, ellipse, inkStyle, vGrad, tube, TAU, type Ctx, type Pt } from './draw'
import { paintBody } from './bodies'
import type { HeadInfo, Rig } from './rig'

const jig = (rig: Rig, i: number, amp = 0.7) => {
  const a = (0.8 + rig.wob * 3.5) * amp
  return { x: Math.sin(rig.t * 2.6 + i * 1.9) * a, y: Math.cos(rig.t * 2.1 + i * 2.4) * a }
}

function ringPath(rig: Rig, n: number, cx: number, cy: number, rx: number, ry: number, k = 1, amp = 0.7): Path2D {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU
    const j = jig(rig, i, amp)
    pts.push({ x: cx + Math.cos(th) * rx + j.x, y: cy + Math.sin(th) * ry + j.y })
  }
  const p = new Path2D()
  smoothClosed(p, pts, k)
  return p
}

function curlHorn(ctx: Ctx, rig: Rig, x: number, y: number, dir: number, size: number, swayPhase: number) {
  const sway = Math.sin(rig.t * 2 + swayPhase) * 1.5
  const pts: Pt[] = [
    { x: x, y: y },
    { x: x + dir * 8 * size, y: y - 14 * size },
    { x: x + dir * 22 * size + sway, y: y - 30 * size },
    { x: x + dir * 30 * size + sway, y: y - 44 * size },
    { x: x + dir * 22 * size + sway, y: y - 52 * size },
  ]
  const bone = rig.pal.belly
  tube(ctx, pts.slice(0, 4), 16 * size, mix(bone, '#ffffff', 0.2), 5)
  // taper: draw finer tip
  tube(ctx, pts.slice(2), 8 * size, mix(bone, '#ffe9b0', 0.5), 4.5)
}

export type HeadFn = (ctx: Ctx, rig: Rig, baseY: number) => HeadInfo

export const HEADS: Record<string, HeadFn> = {
  bare() {
    return { top: 0, faceY: 0, faceW: 0, crownY: 0 }
  },
  dome(ctx, rig, y) {
    const cy = y - 38
    // ears
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ellipse(ctx, s * 48, cy - 6 + Math.sin(rig.t * 3 + s) * 1.2, 15, 16)
      ctx.fillStyle = rig.pal.main
      ctx.fill()
      inkStyle(ctx, 6)
      ctx.stroke()
      ctx.beginPath()
      ellipse(ctx, s * 48, cy - 6, 7, 8)
      ctx.fillStyle = rgba(rig.pal.accent, 0.6)
      ctx.fill()
    }
    const path = ringPath(rig, 12, 0, cy, 56, 46)
    paintBody(ctx, rig, path, { cx: 0, cy, rx: 56, ry: 46, outline: 6.5 })
    return { top: y - 84, faceY: cy + 2, faceW: 92, crownY: y - 80 }
  },
  horned(ctx, rig, y) {
    const cy = y - 34
    curlHorn(ctx, rig, -34, cy - 30, -1, 1.1, 0)
    curlHorn(ctx, rig, 34, cy - 30, 1, 1.1, 1)
    const path = ringPath(rig, 12, 0, cy, 60, 42)
    paintBody(ctx, rig, path, { cx: 0, cy, rx: 60, ry: 42 })
    return { top: y - 76, faceY: cy + 3, faceW: 98, crownY: y - 72 }
  },
  shroom(ctx, rig, y) {
    const cy = y - 24
    const face = ringPath(rig, 12, 0, cy, 46, 36)
    paintBody(ctx, rig, face, { cx: 0, cy, rx: 46, ry: 36, noPattern: true, fillOverride: vGrad(ctx, cy - 36, cy + 36, [[0, lighten(rig.pal.belly, 0.2)], [1, mix(rig.pal.belly, rig.pal.main, 0.35)]]) })
    // cap
    const cap = new Path2D()
    const capCol = rig.pal.accent
    const pts: Pt[] = []
    const n = 14
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI
      const j = jig(rig, i + 20, 0.6)
      pts.push({ x: Math.cos(a) * 82 + j.x, y: cy - 30 + Math.sin(a) * 62 + j.y })
    }
    pts.push({ x: 70, y: cy - 20 }, { x: 0, y: cy - 12 }, { x: -70, y: cy - 20 })
    smoothClosed(cap, pts, 0.9)
    ctx.save()
    ctx.fillStyle = vGrad(ctx, cy - 94, cy - 14, [[0, lighten(capCol, 0.35)], [0.5, capCol], [1, mix(capCol, INK, 0.35)]])
    ctx.fill(cap)
    ctx.save()
    ctx.clip(cap)
    ctx.fillStyle = rgba('#ffffff', 0.85)
    const spots: [number, number, number][] = [[-38, -62, 11], [10, -80, 13], [46, -52, 10], [-8, -48, 7], [-60, -36, 7], [66, -32, 6]]
    for (const [sx, sy, r] of spots) {
      ctx.beginPath()
      ellipse(ctx, sx, cy + sy + 20, r, r * 0.85)
      ctx.fill()
    }
    ctx.fillStyle = rgba('#fff', 0.3)
    ctx.beginPath()
    ellipse(ctx, -44, cy - 62, 26, 9, -0.5)
    ctx.fill()
    ctx.restore()
    inkStyle(ctx, 6.5)
    ctx.stroke(cap)
    ctx.restore()
    return { top: cy - 92, faceY: cy + 6, faceW: 76, crownY: cy - 30 }
  },
  cone(ctx, rig, y) {
    const cy = y - 34
    const path = ringPath(rig, 12, 0, cy, 52, 42)
    paintBody(ctx, rig, path, { cx: 0, cy, rx: 52, ry: 42 })
    // party hat
    const sway = Math.sin(rig.t * 2.2) * 3
    ctx.save()
    ctx.translate(0, cy - 36)
    ctx.rotate(0.12)
    const hat = new Path2D()
    roundedPoly(hat, [{ x: -34, y: 2 }, { x: 34, y: 2 }, { x: 4 + sway, y: -88 }], 5)
    ctx.fillStyle = vGrad(ctx, -88, 4, [[0, lighten(rig.pal.accent, 0.3)], [1, mix(rig.pal.accent, INK, 0.2)]])
    ctx.fill(hat)
    ctx.save()
    ctx.clip(hat)
    ctx.strokeStyle = rgba('#ffffff', 0.7)
    ctx.lineWidth = 8
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(-50, -4 - i * 24 + 22)
      ctx.lineTo(50, -4 - i * 24 - 8)
      ctx.stroke()
    }
    ctx.restore()
    inkStyle(ctx, 6.5)
    ctx.stroke(hat)
    ctx.beginPath()
    ellipse(ctx, 4 + sway, -92, 11, 11)
    ctx.fillStyle = '#ffe08a'
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    return { top: y - 130, faceY: cy + 6, faceW: 88, crownY: cy - 36 }
  },
  bulb(ctx, rig, y) {
    const cy = y - 50
    // antennae
    for (const s of [-1, 1]) {
      const sw = Math.sin(rig.t * 2.4 + s * 1.4) * 5
      const pts: Pt[] = [{ x: s * 18, y: cy - 48 }, { x: s * 30 + sw * 0.4, y: cy - 70 }, { x: s * 34 + sw, y: cy - 92 }]
      tube(ctx, pts, 5, rig.pal.dark, 4.5)
      ctx.beginPath()
      ellipse(ctx, s * 34 + sw, cy - 96, 10, 10)
      ctx.fillStyle = rig.pal.accent
      ctx.fill()
      inkStyle(ctx, 5)
      ctx.stroke()
    }
    const path = ringPath(rig, 14, 0, cy, 60, 58, 1, 0.9)
    paintBody(ctx, rig, path, {
      cx: 0, cy, rx: 60, ry: 58,
      after: (c) => {
        c.strokeStyle = rgba(rig.pal.dark, 0.35)
        c.lineWidth = 4
        c.lineCap = 'round'
        for (let i = 0; i < 4; i++) {
          c.beginPath()
          c.moveTo(-40 + i * 24, cy - 56)
          c.bezierCurveTo(-30 + i * 20, cy - 36, -50 + i * 26, cy - 22, -36 + i * 24, cy - 10)
          c.stroke()
        }
      },
    })
    return { top: y - 110, faceY: cy + 14, faceW: 88, crownY: cy - 52 }
  },
  square(ctx, rig, y) {
    const top = y - 86
    // bolts
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#b9bfcf'
      ctx.beginPath()
      roundedPoly(ctx, [{ x: s * 50, y: y - 52 }, { x: s * 72, y: y - 52 }, { x: s * 72, y: y - 36 }, { x: s * 50, y: y - 36 }], 3)
      ctx.fill()
      inkStyle(ctx, 5)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(s * 72, y - 59); ctx.lineTo(s * 72, y - 29)
      ctx.lineWidth = 9
      ctx.stroke()
    }
    const pts = [{ x: -54, y: top }, { x: 54, y: top }, { x: 56, y: y + 4 }, { x: -56, y: y + 4 }].map((p, i) => ({ x: p.x + jig(rig, i, 0.5).x, y: p.y + jig(rig, i, 0.5).y }))
    const path = new Path2D()
    roundedPoly(path, pts, 18)
    paintBody(ctx, rig, path, {
      cx: 0, cy: y - 42, rx: 56, ry: 44, noPattern: true,
      after: (c) => {
        // hair slab
        c.fillStyle = rgba(INK, 0.82)
        c.beginPath()
        c.moveTo(-60, top - 4); c.lineTo(60, top - 4); c.lineTo(60, top + 14)
        for (let i = 0; i <= 6; i++) c.lineTo(52 - i * 17.5, top + (i % 2 ? 22 : 12))
        c.closePath()
        c.fill()
        // scar
        c.strokeStyle = rgba(INK, 0.6)
        c.lineWidth = 3.5
        c.beginPath()
        c.moveTo(14, top + 28); c.lineTo(38, top + 34)
        c.stroke()
        for (let i = 0; i < 3; i++) {
          c.beginPath()
          c.moveTo(20 + i * 8, top + 24); c.lineTo(22 + i * 8, top + 40)
          c.stroke()
        }
      },
    })
    return { top: top - 6, faceY: y - 36, faceW: 92, crownY: top + 10 }
  },
  skull(ctx, rig, y) {
    const cy = y - 46
    const bone = mix(rig.pal.belly, '#fff6dc', 0.5)
    const pts: Pt[] = []
    const n = 14
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI
      const j = jig(rig, i, 0.6)
      pts.push({ x: Math.cos(a) * 58 + j.x, y: cy - 4 + Math.sin(a) * 50 + j.y })
    }
    pts.push({ x: 52, y: y - 8 }, { x: 40, y: y + 6 }, { x: -40, y: y + 6 }, { x: -52, y: y - 8 })
    const path = new Path2D()
    smoothClosed(path, pts, 0.8)
    paintBody(ctx, rig, path, {
      cx: 0, cy, rx: 58, ry: 52, noPattern: true,
      fillOverride: vGrad(ctx, cy - 52, cy + 52, [[0, '#ffffff'], [0.4, bone], [1, mix(bone, rig.pal.dark, 0.45)]]),
      after: (c) => {
        // teeth
        c.strokeStyle = rgba(INK, 0.75)
        c.lineWidth = 3.5
        c.beginPath()
        c.moveTo(-34, y - 6); c.lineTo(34, y - 6)
        for (let i = -3; i <= 3; i++) { c.moveTo(i * 10, y - 6); c.lineTo(i * 10, y + 8) }
        c.stroke()
        // cracks
        c.beginPath()
        c.moveTo(22, cy - 52); c.lineTo(30, cy - 38); c.lineTo(22, cy - 30)
        c.stroke()
      },
    })
    return { top: cy - 54, faceY: cy - 4, faceW: 92, crownY: cy - 50 }
  },
}

export function drawHead(ctx: Ctx, rig: Rig, id: string, baseY: number): HeadInfo {
  return (HEADS[id] ?? HEADS.bare)(ctx, rig, baseY)
}
