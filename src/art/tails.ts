import { INK } from '../core/palettes'
import { mix, lighten, darken, rgba, smoothClosed, ellipse, inkStyle, tube, taperPath, bezierSpine, rGrad, vGrad, type Ctx, type Pt } from './draw'
import type { BodyInfo, Rig } from './rig'

const col = (rig: Rig) => mix(rig.pal.main, rig.pal.dark, 0.35)

function root(b: BodyInfo): Pt {
  return { x: b.halfW * 0.55, y: b.hipY - 8 }
}

function curve(rig: Rig, b: BodyInfo, len: number, lift: number, curl: number, n = 12): Pt[] {
  const r = root(b)
  const s = Math.sin(rig.t * 2.1) * 8 + rig.wob * Math.sin(rig.t * 13) * 6
  return bezierSpine(
    r,
    { x: r.x + len * 0.35, y: r.y + 6 },
    { x: r.x + len * 0.7 + s * 0.4, y: r.y - lift * 0.3 + curl },
    { x: r.x + len + s, y: r.y - lift - curl * 0.4 },
    n,
  )
}

export const TAILS: Record<string, (ctx: Ctx, rig: Rig, b: BodyInfo) => void> = {
  none() {},
  lizard(ctx, rig, b) {
    const sp = curve(rig, b, 110, 36, 20)
    const p = new Path2D()
    smoothClosed(p, taperPath(sp, 30, 6), 0.9)
    ctx.fillStyle = vGrad(ctx, -120, 10, [[0, lighten(col(rig), 0.2)], [1, darken(col(rig), 0.12)]])
    ctx.fill(p)
    inkStyle(ctx, 6)
    ctx.stroke(p)
    ctx.fillStyle = rgba(rig.pal.accent, 0.5)
    for (let i = 2; i < 9; i += 2) {
      ctx.beginPath()
      ellipse(ctx, sp[i].x, sp[i].y - 2, 4.5 - i * 0.3, 4.5 - i * 0.3)
      ctx.fill()
    }
  },
  spade(ctx, rig, b) {
    const sp = curve(rig, b, 100, 56, -10)
    tube(ctx, sp, 9, col(rig), 5)
    const e = sp[sp.length - 1]
    const prev = sp[sp.length - 3]
    const ang = Math.atan2(e.y - prev.y, e.x - prev.x)
    ctx.save()
    ctx.translate(e.x, e.y)
    ctx.rotate(ang + Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(0, -20)
    ctx.quadraticCurveTo(24, 2, 0, 18)
    ctx.quadraticCurveTo(-24, 2, 0, -20)
    ctx.closePath()
    ctx.fillStyle = rig.pal.accent
    ctx.fill()
    inkStyle(ctx, 5.5)
    ctx.stroke()
    ctx.restore()
  },
  fluff(ctx, rig, b) {
    const sp = curve(rig, b, 70, 24, 8, 8)
    tube(ctx, sp, 11, col(rig), 5)
    const e = sp[sp.length - 1]
    ctx.save()
    ctx.translate(e.x + 12, e.y - 10)
    const sc = 1 + Math.sin(rig.t * 3) * 0.04
    ctx.scale(sc, sc)
    const puffs: [number, number, number][] = [[0, 0, 28], [-18, 10, 20], [18, 10, 20], [-4, -20, 20], [14, -12, 18], [-20, -8, 16]]
    ctx.fillStyle = rig.pal.belly
    inkStyle(ctx, 6)
    for (const [px, py, r] of puffs) {
      ctx.beginPath()
      ellipse(ctx, px, py, r, r)
      ctx.stroke()
    }
    for (const [px, py, r] of puffs) {
      ctx.beginPath()
      ellipse(ctx, px, py, r - 1, r - 1)
      ctx.fill()
    }
    ctx.fillStyle = rgba('#fff', 0.8)
    ctx.beginPath()
    ellipse(ctx, -6, -8, 10, 7)
    ctx.fill()
    ctx.restore()
  },
  fish(ctx, rig, b) {
    const sp = curve(rig, b, 70, 18, 10, 8)
    tube(ctx, sp, 18, col(rig), 5.5)
    const e = sp[sp.length - 1]
    ctx.save()
    ctx.translate(e.x, e.y)
    ctx.rotate(-0.4 + Math.sin(rig.t * 4) * 0.12)
    const fin = new Path2D()
    fin.moveTo(0, 0)
    fin.quadraticCurveTo(24, -52, 62, -50)
    fin.quadraticCurveTo(46, -22, 66, 6)
    fin.quadraticCurveTo(36, 12, 62, 46)
    fin.quadraticCurveTo(26, 40, 0, 8)
    fin.closePath()
    ctx.fillStyle = vGrad(ctx, -50, 50, [[0, lighten(rig.pal.accent, 0.3)], [1, rig.pal.accent]])
    ctx.fill(fin)
    inkStyle(ctx, 6)
    ctx.stroke(fin)
    ctx.strokeStyle = rgba(INK, 0.4)
    ctx.lineWidth = 3
    ctx.beginPath()
    for (const [x, y] of [[54, -40], [58, -4], [54, 36]]) {
      ctx.moveTo(4, 0)
      ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.restore()
  },
  scorpion(ctx, rig, b) {
    const r = root(b)
    const sw = Math.sin(rig.t * 2.6) * 4
    const pts: Pt[] = [
      { x: r.x, y: r.y },
      { x: r.x + 34, y: r.y + 6 },
      { x: r.x + 62, y: r.y - 20 },
      { x: r.x + 66 + sw * 0.4, y: r.y - 62 },
      { x: r.x + 44 + sw * 0.8, y: r.y - 98 },
      { x: r.x + 18 + sw, y: r.y - 108 },
    ]
    tube(ctx, pts, 22, col(rig), 5.5)
    ctx.strokeStyle = rgba(INK, 0.4)
    ctx.lineWidth = 3
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.beginPath()
      ctx.arc(pts[i].x, pts[i].y, 11, 0, Math.PI * 2)
      ctx.stroke()
    }
    const e = pts[pts.length - 1]
    ctx.save()
    ctx.translate(e.x, e.y)
    ctx.rotate(-2.2)
    ctx.scale(1.5, 1.5)
    ctx.beginPath()
    ctx.moveTo(-10, 0)
    ctx.quadraticCurveTo(-2, -26, 8, -40)
    ctx.quadraticCurveTo(12, -20, 10, 0)
    ctx.closePath()
    ctx.fillStyle = rig.pal.accent
    ctx.fill()
    inkStyle(ctx, 5)
    ctx.stroke()
    ctx.restore()
  },
  flame(ctx, rig, b) {
    const sp = curve(rig, b, 80, 40, 6, 9)
    const p = new Path2D()
    smoothClosed(p, taperPath(sp, 24, 8), 0.9)
    ctx.fillStyle = col(rig)
    ctx.fill(p)
    inkStyle(ctx, 6)
    ctx.stroke(p)
    const e = sp[sp.length - 1]
    flame(ctx, rig, e.x, e.y + 6, 1.1, 0)
  },
  lantern(ctx, rig, b) {
    const r = root(b)
    const sw = Math.sin(rig.t * 2.2) * 5
    const pts: Pt[] = [{ x: r.x, y: r.y }, { x: r.x + 50, y: r.y - 10 }, { x: r.x + 76, y: r.y - 60 }, { x: r.x + 56 + sw, y: r.y - 100 }]
    tube(ctx, pts, 6, '#3d2a58', 4)
    const e = pts[pts.length - 1]
    const pulse = 0.85 + Math.sin(rig.t * 4) * 0.15
    ctx.save()
    const g = rGrad(ctx, e.x, e.y + 14, 4, 52 * pulse, [[0, rgba('#fff3a8', 0.9)], [0.4, rgba('#ffd23a', 0.35)], [1, rgba('#ffd23a', 0)]])
    ctx.fillStyle = g
    ctx.beginPath()
    ellipse(ctx, e.x, e.y + 14, 58, 58)
    ctx.fill()
    ctx.beginPath()
    ellipse(ctx, e.x, e.y + 14, 15, 18)
    ctx.fillStyle = rGrad(ctx, e.x - 3, e.y + 8, 1, 18, [[0, '#ffffff'], [0.5, '#ffe36a'], [1, '#ffa81f']])
    ctx.fill()
    inkStyle(ctx, 5)
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.fillRect(e.x - 10, e.y - 6, 20, 6)
    ctx.restore()
  },
}

export function flame(ctx: Ctx, rig: Rig, x: number, y: number, sc: number, ph: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sc, sc)
  const layers: [string, number][] = [['#ff5a1f', 1], ['#ff9b2a', 0.74], ['#ffe36a', 0.46]]
  for (const [c, k] of layers) {
    const fl = Math.sin(rig.t * 11 + ph) * 3 + Math.sin(rig.t * 17 + ph) * 2
    ctx.beginPath()
    ctx.moveTo(-20 * k, 0)
    ctx.bezierCurveTo(-26 * k, -26 * k, -6 * k + fl, -40 * k, fl * 1.3, -66 * k - fl)
    ctx.bezierCurveTo(10 * k + fl * 0.5, -40 * k, 26 * k, -26 * k, 20 * k, 0)
    ctx.quadraticCurveTo(0, 12 * k, -20 * k, 0)
    ctx.closePath()
    ctx.fillStyle = c
    ctx.fill()
    if (k === 1) {
      inkStyle(ctx, 4.5)
      ctx.stroke()
    }
  }
  ctx.restore()
}
void darken
