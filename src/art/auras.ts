import { INK } from '../core/palettes'
import { rgba, ellipse, inkStyle, star4, rGrad, TAU, type Ctx } from './draw'
import type { Rig } from './rig'
import { flame } from './tails'

const CY = -100

export const AURA_BACK: Record<string, (ctx: Ctx, rig: Rig) => void> = {
  none() {},
  sparkles() {},
  flames(ctx, rig) {
    const n = 9
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI
      const x = Math.cos(a) * 118
      const y = CY + 70 + Math.sin(a) * 112 * 0.8
      ctx.save()
      ctx.globalAlpha = 0.95
      ctx.translate(x, y)
      ctx.rotate(Math.cos(a) * 0.5)
      flame(ctx, rig, 0, 0, 0.75 + 0.2 * Math.sin(i * 2.1), i * 1.3)
      ctx.restore()
    }
    const g = rGrad(ctx, 0, CY, 20, 150, [[0, rgba('#ff9b2a', 0)], [0.7, rgba('#ff5a1f', 0.16)], [1, rgba('#ff5a1f', 0)]])
    ctx.fillStyle = g
    ctx.beginPath()
    ellipse(ctx, 0, CY, 160, 160)
    ctx.fill()
  },
  mist(ctx, rig) {
    for (let i = 0; i < 6; i++) {
      const dx = Math.sin(rig.t * 0.5 + i * 1.9) * 24
      const x = (i - 2.5) * 40 + dx
      const y = -8 - (i % 3) * 22 + Math.sin(rig.t * 0.8 + i) * 4
      const g = rGrad(ctx, x, y, 4, 56, [[0, rgba('#d9f7ff', 0.5)], [1, rgba('#d9f7ff', 0)]])
      ctx.fillStyle = g
      ctx.beginPath()
      ellipse(ctx, x, y, 58, 32)
      ctx.fill()
    }
  },
  drips(ctx, rig) {
    // goo puddle
    ctx.beginPath()
    ellipse(ctx, 0, 0, 118, 16)
    ctx.fillStyle = rgba('#5cf0a8', 0.75)
    ctx.fill()
    inkStyle(ctx, 4)
    ctx.stroke()
    ctx.fillStyle = rgba('#ffffff', 0.6)
    ctx.beginPath()
    ellipse(ctx, -40, -3, 22, 4)
    ctx.fill()
  },
  moons(ctx, rig) {
    // back half of the orbit
    for (let i = 0; i < 3; i++) {
      const a = rig.t * 0.9 + (i / 3) * TAU
      if (Math.sin(a) >= 0) continue
      orbitItem(ctx, rig, a, i, 1.25)
    }
  },
  volt() {},
  bats(ctx, rig) {
    for (let i = 0; i < 4; i++) {
      const a = rig.t * 0.8 + (i / 4) * TAU
      if (Math.sin(a) >= 0) continue
      miniBat(ctx, rig, a, i, 1.2)
    }
  },
}

function orbitItem(ctx: Ctx, rig: Rig, a: number, i: number, sc: number) {
  const x = Math.cos(a) * 128
  const y = CY - 20 + Math.sin(a) * 34 - (i - 1) * 30
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sc, sc)
  if (i % 2 === 0) {
    ctx.beginPath()
    ctx.arc(0, 0, 15, 0.5, Math.PI * 2 - 0.5)
    ctx.arc(7, 0, 12, Math.PI * 2 - 0.9, 0.9, true)
    ctx.closePath()
    ctx.fillStyle = '#ffe9a0'
    ctx.fill()
    inkStyle(ctx, 4.5)
    ctx.stroke()
  } else {
    ctx.beginPath()
    star4(ctx, 0, 0, 13, 0.45)
    ctx.fillStyle = '#fff6c2'
    ctx.fill()
    inkStyle(ctx, 4)
    ctx.stroke()
  }
  ctx.restore()
}

function miniBat(ctx: Ctx, rig: Rig, a: number, i: number, sc: number) {
  const x = Math.cos(a) * 136
  const y = CY - 30 + Math.sin(a) * 40 - Math.sin(rig.t * 2 + i) * 14 - 20 + i * 14
  const fl = Math.sin(rig.t * 14 + i * 2) * 0.55
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sc, sc)
  ctx.fillStyle = '#2a1844'
  for (const s of [-1, 1]) {
    ctx.save()
    ctx.scale(s, 1)
    ctx.rotate(-fl)
    ctx.beginPath()
    ctx.moveTo(2, 0)
    ctx.quadraticCurveTo(14, -18, 30, -10)
    ctx.quadraticCurveTo(24, -4, 26, 4)
    ctx.quadraticCurveTo(16, 0, 12, 8)
    ctx.quadraticCurveTo(6, 2, 2, 6)
    ctx.closePath()
    ctx.fill()
    inkStyle(ctx, 3)
    ctx.strokeStyle = '#8f55f4'
    ctx.stroke()
    ctx.restore()
  }
  ctx.beginPath()
  ellipse(ctx, 0, 1, 7, 9)
  ctx.fillStyle = '#2a1844'
  ctx.fill()
  ctx.strokeStyle = '#8f55f4'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#ffe36a'
  ctx.fillRect(-4, -1, 2.5, 2.5)
  ctx.fillRect(1.5, -1, 2.5, 2.5)
  ctx.restore()
}

export const AURA_FRONT: Record<string, (ctx: Ctx, rig: Rig) => void> = {
  none() {},
  flames() {},
  sparkles(ctx, rig) {
    const cols = ['#fff6c2', '#ffd23f', '#ffffff', rig.pal.accent, '#9dffe0']
    for (let i = 0; i < 11; i++) {
      const tw = (Math.sin(rig.t * 3 + i * 1.7) + 1) / 2
      const a = rig.rnd(i + 60) * TAU
      const d = 100 + rig.rnd(i + 70) * 50
      const x = Math.cos(a) * d * 1.05
      const y = CY - 30 + Math.sin(a) * d * 0.95
      const r = 9 + tw * 20 + rig.rnd(i + 80) * 8
      ctx.beginPath()
      star4(ctx, x, y, r, 0.22)
      ctx.fillStyle = cols[i % cols.length]
      ctx.fill()
      inkStyle(ctx, 2.5)
      ctx.globalAlpha = 0.8
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  },
  mist(ctx, rig) {
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 52 + Math.sin(rig.t * 0.6 + i * 2.2) * 26
      const y = -6 - (i % 2) * 14
      const g = rGrad(ctx, x, y, 2, 40, [[0, rgba('#d9f7ff', 0.4)], [1, rgba('#d9f7ff', 0)]])
      ctx.fillStyle = g
      ctx.beginPath()
      ellipse(ctx, x, y, 46, 22)
      ctx.fill()
    }
  },
  drips(ctx, rig) {
    for (let i = 0; i < 6; i++) {
      const ph = (rig.t * 0.55 + i * 0.37) % 1
      const x = -110 + i * 44 + Math.sin(i * 7) * 10
      const y = CY - 100 + ph * 108
      const sz = 8 + (i % 3) * 3
      ctx.beginPath()
      ctx.moveTo(x, y - sz * 2)
      ctx.quadraticCurveTo(x + sz * 1.2, y, x, y + sz)
      ctx.quadraticCurveTo(x - sz * 1.2, y, x, y - sz * 2)
      ctx.fillStyle = rgba('#5cf0a8', 0.9 * (1 - ph * ph))
      ctx.fill()
      ctx.strokeStyle = rgba(INK, 0.6 * (1 - ph * ph))
      ctx.lineWidth = 3
      ctx.stroke()
    }
  },
  moons(ctx, rig) {
    for (let i = 0; i < 3; i++) {
      const a = rig.t * 0.9 + (i / 3) * TAU
      if (Math.sin(a) < 0) continue
      orbitItem(ctx, rig, a, i, 1.8)
    }
  },
  volt(ctx, rig) {
    const frame = Math.floor(rig.t * 9)
    for (let i = 0; i < 6; i++) {
      const seed = (frame * 7 + i * 13) % 11
      const a = (i / 6) * TAU + 0.3
      const x0 = Math.cos(a) * 92
      const y0 = CY + Math.sin(a) * 100
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      for (let k = 1; k <= 4; k++) {
        ctx.lineTo(x0 + Math.cos(a) * k * 15 + ((seed + k * 5) % 7 - 3) * 4, y0 + Math.sin(a) * k * 15 + ((seed * 3 + k * 2) % 7 - 3) * 4)
      }
      ctx.strokeStyle = '#fff6a0'
      ctx.lineWidth = 7
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = 0.5 + 0.4 * ((seed % 3) / 2)
      ctx.stroke()
      ctx.strokeStyle = '#ffe300'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  },
  bats(ctx, rig) {
    for (let i = 0; i < 4; i++) {
      const a = rig.t * 0.8 + (i / 4) * TAU
      if (Math.sin(a) < 0) continue
      miniBat(ctx, rig, a, i, 1.7)
    }
  },
}
