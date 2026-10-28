import { INK } from '../core/palettes'
import { mix, lighten, darken, rgba, smoothClosed, smoothOpen, ellipse, inkStyle, tube, vGrad, lGrad, TAU, type Ctx, type Pt } from './draw'
import type { BodyInfo, Rig } from './rig'

const limbCol = (rig: Rig) => mix(rig.pal.main, rig.pal.dark, 0.45)

function foot(ctx: Ctx, rig: Rig, x: number, w = 22, claws = false) {
  ctx.save()
  const pts: Pt[] = [{ x: x - w, y: -4 }, { x: x - w * 0.8, y: -16 }, { x: x, y: -20 }, { x: x + w * 0.8, y: -16 }, { x: x + w, y: -4 }, { x: x, y: 2 }]
  const p = new Path2D()
  smoothClosed(p, pts, 0.9)
  ctx.fillStyle = vGrad(ctx, -20, 2, [[0, lighten(limbCol(rig), 0.25)], [1, darken(limbCol(rig), 0.15)]])
  ctx.fill(p)
  inkStyle(ctx, 5.5)
  ctx.stroke(p)
  if (claws) {
    ctx.fillStyle = '#fff6dc'
    for (const k of [-0.5, 0, 0.5]) {
      ctx.beginPath()
      ctx.moveTo(x + k * w - 4, 1)
      ctx.lineTo(x + k * w + 4, 1)
      ctx.lineTo(x + k * w * 1.1, 10)
      ctx.closePath()
      ctx.fill()
      ctx.lineWidth = 3
      ctx.stroke()
    }
  }
  ctx.restore()
}

function hand(ctx: Ctx, rig: Rig, x: number, y: number, r: number) {
  ctx.beginPath()
  ellipse(ctx, x, y, r, r * 0.92)
  ctx.fillStyle = lighten(limbCol(rig), 0.12)
  ctx.fill()
  inkStyle(ctx, 5.5)
  ctx.stroke()
}

function clawTips(ctx: Ctx, x: number, y: number, ang: number, n = 3, len = 14) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * 0.55
    ctx.save()
    ctx.rotate(a)
    ctx.beginPath()
    ctx.moveTo(-4.5, -8)
    ctx.quadraticCurveTo(0, -len - 6, 5, -8)
    ctx.closePath()
    ctx.fillStyle = '#fff6dc'
    ctx.fill()
    inkStyle(ctx, 3.2)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

function sway(rig: Rig, ph: number, amp = 1) {
  return Math.sin(rig.t * 2.4 + ph) * 4 * amp + rig.wob * Math.sin(rig.t * 14 + ph) * 3
}

function batWing(ctx: Ctx, rig: Rig, b: BodyInfo, s: number, fur: string, mem: string, moth = false) {
  const flap = Math.sin(rig.t * (moth ? 3.2 : 3.6) + (s > 0 ? 0 : 0.3)) * (moth ? 0.12 : 0.16) + (rig.mood === 'scared' ? 0.15 : 0)
  ctx.save()
  ctx.translate(s * (b.shoulderX - 10), b.shoulderY - 14)
  ctx.scale(s, 1)
  ctx.rotate(-flap)
  if (!moth) {
    const wing = new Path2D()
    wing.moveTo(0, 0)
    wing.quadraticCurveTo(40, -58, 112, -66)
    wing.quadraticCurveTo(100, -40, 106, -14)
    wing.quadraticCurveTo(88, -26, 82, 8)
    wing.quadraticCurveTo(62, -8, 52, 24)
    wing.quadraticCurveTo(32, 4, 16, 28)
    wing.closePath()
    ctx.fillStyle = lGrad(ctx, 0, -40, 110, 20, [[0, mix(mem, '#ffffff', 0.15)], [1, darken(mem, 0.25)]])
    ctx.fill(wing)
    inkStyle(ctx, 6)
    ctx.stroke(wing)
    ctx.strokeStyle = rgba(INK, 0.55)
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(0, 0); ctx.lineTo(106, -14)
    ctx.moveTo(0, 0); ctx.lineTo(82, 8)
    ctx.moveTo(0, 0); ctx.lineTo(52, 24)
    ctx.stroke()
  } else {
    const upper = new Path2D()
    const wing = [
      { x: 0, y: 0 }, { x: 36, y: -62 }, { x: 96, y: -86 }, { x: 128, y: -52 }, { x: 108, y: -8 }, { x: 62, y: 12 },
    ]
    smoothClosed(upper, wing, 0.95)
    const lower = new Path2D()
    smoothClosed(lower, [{ x: 4, y: 6 }, { x: 52, y: 14 }, { x: 88, y: 38 }, { x: 70, y: 66 }, { x: 28, y: 52 }], 0.95)
    for (const [pth, col] of [[lower, mix(mem, rig.pal.dark, 0.2)], [upper, mem]] as const) {
      ctx.fillStyle = lGrad(ctx, 0, -60, 120, 20, [[0, lighten(col, 0.22)], [1, darken(col, 0.18)]])
      ctx.fill(pth)
      inkStyle(ctx, 6)
      ctx.stroke(pth)
    }
    // eyespots
    for (const [ex, ey, er] of [[84, -52, 17], [62, 38, 10]] as const) {
      ctx.beginPath()
      ellipse(ctx, ex, ey, er, er)
      ctx.fillStyle = rig.pal.accent
      ctx.fill()
      inkStyle(ctx, 4)
      ctx.stroke()
      ctx.beginPath()
      ellipse(ctx, ex, ey, er * 0.5, er * 0.5)
      ctx.fillStyle = INK
      ctx.fill()
      ctx.beginPath()
      ellipse(ctx, ex - er * 0.2, ey - er * 0.2, er * 0.18, er * 0.18)
      ctx.fillStyle = '#fff'
      ctx.fill()
    }
  }
  ctx.restore()
  void fur
}

function arm(ctx: Ctx, rig: Rig, b: BodyInfo, s: number, len: number, up: number, th: number, ph: number) {
  const sx = s * (b.shoulderX - 6)
  const sy = b.shoulderY
  const sw = sway(rig, ph + (s > 0 ? 0 : 1.7))
  const tip: Pt = { x: sx + s * len * 0.8, y: sy + len * 0.55 - up + sw * 0.6 }
  const mid: Pt = { x: sx + s * len * 0.45, y: sy + len * 0.28 - up * 0.2 + sw * 0.3 }
  tube(ctx, [{ x: sx - s * 8, y: sy - 4 }, mid, tip], th, limbCol(rig), 5.5)
  return tip
}

export const LIMBS_BACK: Record<string, (ctx: Ctx, rig: Rig, b: BodyInfo) => void> = {
  stubs() {},
  claws() {},
  noodle() {},
  pincers() {},
  tentacles() {},
  bat(ctx, rig, b) {
    for (const s of [-1, 1]) batWing(ctx, rig, b, s, rig.pal.dark, mix(rig.pal.dark, rig.pal.accent, 0.3))
  },
  moth(ctx, rig, b) {
    for (const s of [-1, 1]) batWing(ctx, rig, b, s, rig.pal.dark, mix(rig.pal.light, rig.pal.accent, 0.35), true)
  },
  spider(ctx, rig, b) {
    // four legs per side: out and up to a knee, then down to the ground
    const legs = [0, 1, 2, 3]
    for (const s of [-1, 1]) {
      for (const i of legs) {
        const k = i / 3
        const y0 = b.midY - 26 + k * 40
        const x0 = s * (b.halfW * (0.55 + 0.25 * k))
        const bend = Math.sin(rig.t * 3 + i * 0.9 + (s > 0 ? 0 : 1)) * 3
        const kneeX = s * (b.halfW + 26 + k * 18)
        const kneeY = y0 - 46 + k * 18 + bend
        const footX = s * (b.halfW + 52 + k * 46 + (i === 0 ? -14 : 0))
        tube(ctx, [{ x: x0, y: y0 }, { x: kneeX, y: kneeY }, { x: (kneeX + footX) / 2 + s * 4, y: kneeY * 0.45 }, { x: footX, y: -3 }], 8, limbCol(rig), 4.5)
      }
    }
  },
}

export const LIMBS_FRONT: Record<string, (ctx: Ctx, rig: Rig, b: BodyInfo) => void> = {
  stubs(ctx, rig, b) {
    for (const s of [-1, 1]) {
      if (!b.floaty) foot(ctx, rig, s * b.hipX)
      const t = arm(ctx, rig, b, s, 38, 0, 15, s)
      hand(ctx, rig, t.x, t.y, 11)
    }
  },
  claws(ctx, rig, b) {
    for (const s of [-1, 1]) {
      if (!b.floaty) foot(ctx, rig, s * b.hipX, 22, true)
      const t = arm(ctx, rig, b, s, 52, 16, 16, s + 1)
      hand(ctx, rig, t.x, t.y, 15)
      clawTips(ctx, t.x, t.y - 6, s * 0.45, 3, 18)
    }
  },
  bat(ctx, rig, b) {
    for (const s of [-1, 1]) {
      if (!b.floaty) foot(ctx, rig, s * b.hipX, 20)
    }
  },
  moth(ctx, rig, b) {
    for (const s of [-1, 1]) {
      if (!b.floaty) foot(ctx, rig, s * b.hipX, 18)
      const t = arm(ctx, rig, b, s, 28, 0, 12, s)
      hand(ctx, rig, t.x, t.y, 9)
    }
  },
  noodle(ctx, rig, b) {
    for (const s of [-1, 1]) {
      if (!b.floaty) foot(ctx, rig, s * b.hipX, 16)
      const sx = s * (b.shoulderX - 6)
      const sy = b.shoulderY
      const ph = s * 1.3
      const pts: Pt[] = []
      for (let i = 0; i < 6; i++) {
        const k = i / 5
        pts.push({ x: sx + s * (k * 112), y: sy + 10 + Math.sin(rig.t * 3.1 + ph + k * 4.8) * 22 * k + k * 34 })
      }
      tube(ctx, pts, 12, limbCol(rig), 5.5)
      const e = pts[pts.length - 1]
      hand(ctx, rig, e.x, e.y, 13)
    }
  },
  pincers(ctx, rig, b) {
    for (const s of [-1, 1]) {
      if (!b.floaty) foot(ctx, rig, s * b.hipX, 20)
      const t = arm(ctx, rig, b, s, 50, 22, 14, s)
      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.scale(s, 1)
      const snip = (Math.sin(rig.t * 4 + s) * 0.5 + 0.5) * 0.35 + (rig.wob > 0.3 ? 0.2 : 0)
      const red = mix('#ff5a3a', rig.pal.main, 0.2)
      for (const k of [-1, 1]) {
        ctx.save()
        ctx.rotate(-0.6 + k * snip)
        const claw = new Path2D()
        claw.moveTo(-12, 4)
        claw.quadraticCurveTo(-18, -26, 2 * k, -44)
        claw.quadraticCurveTo(14, -24, 12, 4)
        claw.closePath()
        ctx.fillStyle = k > 0 ? darken(red, 0.1) : lighten(red, 0.08)
        ctx.fill(claw)
        inkStyle(ctx, 5.5)
        ctx.stroke(claw)
        ctx.restore()
      }
      ctx.beginPath()
      ellipse(ctx, 0, 6, 14, 12)
      ctx.fillStyle = red
      ctx.fill()
      inkStyle(ctx, 5.5)
      ctx.stroke()
      ctx.restore()
    }
  },
  tentacles(ctx, rig, b) {
    const n = 6
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1) - 0.5
      const x0 = k * b.halfW * 1.3
      const ph = i * 1.1
      const pts: Pt[] = []
      for (let j = 0; j < 6; j++) {
        const u = j / 5
        pts.push({
          x: x0 + k * 70 * u + Math.sin(rig.t * 3 + ph + u * 3.6) * 12 * u,
          y: -26 + u * 32 - Math.sin(u * Math.PI) * 4 + (b.floaty ? 8 : 0),
        })
      }
      tube(ctx, pts, 17 - 2 * Math.abs(k * 2), mix(limbCol(rig), rig.pal.accent, 0.12), 5)
      const e = pts[pts.length - 1]
      ctx.fillStyle = rgba('#fff', 0.5)
      for (const u of [0.35, 0.6]) {
        const q = pts[Math.round(u * 5)]
        ctx.beginPath()
        ellipse(ctx, q.x, q.y + 2, 2.5, 2.5)
        ctx.fill()
      }
      void e
    }
    // hands/stubby arms none
    void TAU
    void smoothOpen
  },
}
