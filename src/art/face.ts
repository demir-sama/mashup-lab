import { INK } from '../core/palettes'
import { rgba, ellipse, inkStyle, tube, rGrad, mix, TAU, type Ctx, type Pt } from './draw'
import type { Rig } from './rig'

interface EyeOpts {
  iris?: string
  slit?: boolean
  lid?: number // 0 none .. 1 closed (top lid)
  socket?: boolean
  pupil?: number
}

function eye(ctx: Ctx, rig: Rig, x: number, y: number, r: number, o: EyeOpts = {}) {
  const { mood } = rig
  if (o.socket) {
    ctx.fillStyle = rgba(INK, 0.9)
    ctx.beginPath()
    ellipse(ctx, x, y, r * 1.28, r * 1.35)
    ctx.fill()
  }
  const closed = Math.max(rig.blink, mood === 'sleepy' ? 0.7 : 0)
  if (mood === 'happy' && !o.socket) {
    ctx.strokeStyle = INK
    ctx.lineWidth = Math.max(4, r * 0.34)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(x, y + r * 0.35, r * 0.78, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
    return
  }
  const sc = mood === 'scared' ? 1.12 : 1
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sc, sc * (1 - closed * 0.92))
  // sclera
  ctx.beginPath()
  ellipse(ctx, 0, 0, r, r * 1.08)
  ctx.fillStyle = o.socket ? '#fffbe6' : rGrad(ctx, -r * 0.2, -r * 0.3, r * 0.1, r * 1.2, [[0, '#ffffff'], [1, '#e6e0f5']])
  ctx.fill()
  inkStyle(ctx, Math.max(3.5, r * 0.28))
  ctx.stroke()
  // pupil
  const pr = r * (o.pupil ?? 0.52) * (mood === 'scared' ? 0.6 : 1)
  const px = rig.look.x * (r - pr) * 0.85
  const py = rig.look.y * (r - pr) * 0.85
  if (mood === 'dizzy') {
    ctx.strokeStyle = INK
    ctx.lineWidth = Math.max(2.2, r * 0.14)
    ctx.beginPath()
    for (let a = 0; a < TAU * 2.4; a += 0.3) {
      const rr = (a / (TAU * 2.4)) * r * 0.78
      const aa = a + rig.t * 8
      const xx = Math.cos(aa) * rr
      const yy = Math.sin(aa) * rr
      if (a === 0) ctx.moveTo(xx, yy)
      else ctx.lineTo(xx, yy)
    }
    ctx.stroke()
  } else {
    if (o.iris) {
      ctx.beginPath()
      ellipse(ctx, px, py, r * 0.8, r * 0.82)
      ctx.fillStyle = o.iris
      ctx.fill()
    }
    ctx.beginPath()
    if (o.slit) ellipse(ctx, px, py, pr * 0.34, r * 0.74)
    else ellipse(ctx, px, py, pr, pr)
    ctx.fillStyle = INK
    ctx.fill()
    if (!o.slit) {
      ctx.beginPath()
      ellipse(ctx, px - pr * 0.32, py - pr * 0.36, pr * 0.3, pr * 0.3)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.beginPath()
      ellipse(ctx, px + pr * 0.35, py + pr * 0.38, pr * 0.14, pr * 0.14)
      ctx.fillStyle = rgba('#ffffff', 0.7)
      ctx.fill()
    }
  }
  if (o.lid) {
    ctx.beginPath()
    ctx.rect(-r * 1.4, -r * 1.4, r * 2.8, r * 1.4 * 2 * o.lid * 0.5 + r * 0.1)
    ctx.save()
    ctx.beginPath()
    ellipse(ctx, 0, 0, r, r * 1.08)
    ctx.clip()
    ctx.fillStyle = rig.pal.main
    ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * (0.2 + 1.5 * o.lid) )
    ctx.strokeStyle = INK
    ctx.lineWidth = Math.max(3, r * 0.22)
    ctx.beginPath()
    ctx.moveTo(-r * 1.2, -r * 1.4 + r * (0.2 + 1.5 * o.lid))
    ctx.lineTo(r * 1.2, -r * 1.4 + r * (0.2 + 1.5 * o.lid))
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

export function drawEyes(ctx: Ctx, rig: Rig, id: string, cx: number, cy: number, faceW: number, crownY: number, socket = false) {
  const sk = socket
  const w = faceW
  const bob = Math.sin(rig.t * 1.6) * 0.8
  switch (id) {
    case 'cyclops':
      eye(ctx, rig, cx, cy - w * 0.02 + bob, Math.min(34, w * 0.27), { socket: sk, pupil: 0.55 })
      break
    case 'trio': {
      const r = Math.min(20, w * 0.15)
      eye(ctx, rig, cx - w * 0.27, cy + w * 0.03, r, { socket: sk })
      eye(ctx, rig, cx + w * 0.27, cy + w * 0.03, r, { socket: sk })
      eye(ctx, rig, cx, cy - w * 0.16, r * 0.92, { socket: sk })
      break
    }
    case 'sleepy': {
      const r = Math.min(24, w * 0.17)
      eye(ctx, rig, cx - w * 0.23, cy, r, { socket: sk, lid: 0.55 })
      eye(ctx, rig, cx + w * 0.23, cy, r, { socket: sk, lid: 0.55 })
      break
    }
    case 'slit': {
      const r = Math.min(22, w * 0.16)
      eye(ctx, rig, cx - w * 0.23, cy, r, { socket: sk, slit: true, iris: '#ffd23f' })
      eye(ctx, rig, cx + w * 0.23, cy, r, { socket: sk, slit: true, iris: '#ffd23f' })
      break
    }
    case 'stalks': {
      const r = Math.min(22, w * 0.16)
      for (const s of [-1, 1]) {
        const sw = Math.sin(rig.t * 2.7 + s * 1.3) * 7 + rig.look.x * 8
        const base: Pt = { x: cx + s * w * 0.18, y: crownY + 10 }
        const mid: Pt = { x: cx + s * w * 0.28 + sw * 0.4, y: crownY - 22 }
        const tip: Pt = { x: cx + s * w * 0.36 + sw, y: crownY - 52 + Math.cos(rig.t * 3 + s) * 3 }
        tube(ctx, [base, mid, tip], 7, rig.pal.dark, 4.5)
        eye(ctx, rig, tip.x, tip.y - 6, r * 1.12, {})
      }
      break
    }
    case 'quad': {
      const r = Math.min(15, w * 0.11)
      for (const sx of [-1, 1]) {
        eye(ctx, rig, cx + sx * w * 0.27, cy - w * 0.1, r, { socket: sk })
        eye(ctx, rig, cx + sx * w * 0.13, cy + w * 0.08, r * 0.9, { socket: sk })
      }
      break
    }
    case 'swarm': {
      const spots: [number, number, number][] = [[-0.3, -0.12, 0.13], [0.02, -0.2, 0.1], [0.3, -0.08, 0.14], [-0.16, 0.08, 0.1], [0.14, 0.1, 0.12], [-0.34, 0.14, 0.07]]
      spots.forEach(([dx, dy, rr], i) => {
        const wobx = Math.sin(rig.t * 2 + i) * 1.2
        eye(ctx, rig, cx + dx * w + wobx, cy + dy * w, Math.min(20, w * rr), { socket: sk })
      })
      break
    }
    default: {
      const r = Math.min(24, w * 0.17)
      eye(ctx, rig, cx - w * 0.23, cy, r, { socket: sk })
      eye(ctx, rig, cx + w * 0.23, cy, r, { socket: sk })
    }
  }
}

export function drawMouth(ctx: Ctx, rig: Rig, cx: number, cy: number, w: number, eyeId: string) {
  const mood = rig.mood
  const kind = rig.g.seed % 5
  const mw = Math.min(46, w * 0.26)
  const y = cy + (eyeId === 'cyclops' ? w * 0.26 : eyeId === 'swarm' || eyeId === 'quad' ? w * 0.27 : w * 0.24)
  ctx.save()
  ctx.translate(cx, y)
  inkStyle(ctx, 5)
  const tongue = '#ff6f8f'
  const open = (rw: number, rh: number, tongueOn = true) => {
    ctx.beginPath()
    ctx.moveTo(-rw, -rh * 0.25)
    ctx.quadraticCurveTo(0, rh * 0.15, rw, -rh * 0.25)
    ctx.quadraticCurveTo(rw * 0.7, rh * 1.25, 0, rh * 1.25)
    ctx.quadraticCurveTo(-rw * 0.7, rh * 1.25, -rw, -rh * 0.25)
    ctx.closePath()
    ctx.fillStyle = '#2a0f3a'
    ctx.fill()
    ctx.save()
    ctx.clip()
    if (tongueOn) {
      ctx.fillStyle = tongue
      ctx.beginPath()
      ellipse(ctx, 0, rh * 1.2, rw * 0.6, rh * 0.55)
      ctx.fill()
    }
    ctx.fillStyle = '#fff'
    ctx.fillRect(-rw * 0.7, -rh * 0.3, rw * 1.4, rh * 0.28)
    ctx.restore()
    ctx.stroke()
  }
  if (mood === 'shout') {
    open(mw * 0.95, mw * 0.85)
  } else if (mood === 'scared') {
    ctx.beginPath()
    ctx.moveTo(-mw * 0.7, 3)
    for (let i = 1; i <= 6; i++) ctx.lineTo(-mw * 0.7 + i * (mw * 1.4) / 6, i % 2 ? -3 : 5)
    ctx.stroke()
  } else if (mood === 'dizzy') {
    ctx.beginPath()
    ctx.moveTo(-mw * 0.6, 0)
    ctx.quadraticCurveTo(-mw * 0.3, -8, 0, 0)
    ctx.quadraticCurveTo(mw * 0.3, 8, mw * 0.6, 0)
    ctx.stroke()
  } else if (mood === 'happy') {
    open(mw * 0.8, mw * 0.62)
  } else if (kind === 0) {
    ctx.beginPath()
    ctx.moveTo(-mw * 0.6, -2)
    ctx.quadraticCurveTo(0, mw * 0.55, mw * 0.6, -2)
    ctx.stroke()
  } else if (kind === 1) {
    ctx.beginPath()
    ctx.moveTo(-mw * 0.65, -2)
    ctx.quadraticCurveTo(0, mw * 0.5, mw * 0.65, -2)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(s * mw * 0.32 - 4, 3)
      ctx.lineTo(s * mw * 0.32 + 4, 3)
      ctx.lineTo(s * mw * 0.32, 14)
      ctx.closePath()
      ctx.fill()
      ctx.lineWidth = 3
      ctx.stroke()
    }
  } else if (kind === 2) {
    open(mw * 0.62, mw * 0.5)
  } else if (kind === 3) {
    ctx.beginPath()
    ctx.moveTo(-mw * 0.7, 0)
    for (let i = 1; i <= 8; i++) ctx.lineTo(-mw * 0.7 + i * (mw * 1.4) / 8, i % 2 ? 6 : -2)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(-mw * 0.5, 0)
    ctx.quadraticCurveTo(-mw * 0.25, 7, 0, 0)
    ctx.quadraticCurveTo(mw * 0.25, 7, mw * 0.5, 0)
    ctx.stroke()
  }
  ctx.restore()
  // blush
  ctx.fillStyle = rgba(rig.pal.accent, 0.28)
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ellipse(ctx, cx + s * w * 0.36, y - 6, 8, 5)
    ctx.fill()
  }
  void mix
}
