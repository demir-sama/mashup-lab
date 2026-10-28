import { TAU, star4 } from '../art/draw'

export type Kind = 'spark' | 'goo' | 'star' | 'smoke' | 'bubble' | 'dust' | 'confetti'
export interface P {
  k: Kind
  x: number
  y: number
  vx: number
  vy: number
  g: number
  drag: number
  life: number
  max: number
  size: number
  color: string
  rot: number
  vr: number
  grow: number
}
export interface Ring {
  x: number
  y: number
  r: number
  vr: number
  life: number
  max: number
  color: string
  w: number
}
export interface Splat {
  x: number
  y: number
  r: number
  color: string
  life: number
  max: number
  drip: number
  blobs: { dx: number; dy: number; r: number }[]
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

export class Fx {
  ps: P[] = []
  rings: Ring[] = []
  splats: Splat[] = []
  limit = 520

  add(p: Partial<P> & { k: Kind; x: number; y: number; color: string }) {
    if (this.ps.length > this.limit) this.ps.splice(0, 20)
    this.ps.push({ vx: 0, vy: 0, g: 0, drag: 0, life: 0, max: 1, size: 4, rot: 0, vr: 0, grow: 0, ...p })
  }
  ring(x: number, y: number, color: string, vr = 520, max = 0.7, w = 10) {
    this.rings.push({ x, y, r: 6, vr, life: 0, max, color, w })
  }
  burst(x: number, y: number, n: number, colors: string[], speed: number, kind: Kind = 'spark', size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU
      const s = rnd(speed * 0.35, speed)
      this.add({ k: kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.2, g: kind === 'spark' ? 260 : 520, drag: 0.6, max: rnd(0.5, 1.3), size: rnd(size * 0.6, size * 1.5), color: colors[i % colors.length], rot: Math.random() * TAU, vr: rnd(-8, 8) })
    }
  }
  splat(W: number, H: number, color: string, n: number) {
    const k = Math.min(W, H) / 400
    for (let i = 0; i < n; i++) {
      let x = 0
      let y = 0
      for (let tries = 0; tries < 8; tries++) {
        x = rnd(W * 0.04, W * 0.96)
        y = rnd(H * 0.06, H * 0.8)
        if (Math.abs(x - W / 2) > W * 0.3 || y < H * 0.22) break
      }
      const r = rnd(9, 26) * k
      const blobs = Array.from({ length: 5 }, () => ({ dx: rnd(-r, r) * 0.8, dy: rnd(-r, r) * 0.8, r: rnd(r * 0.25, r * 0.5) }))
      this.splats.push({ x, y, r, color, life: 0, max: rnd(1.6, 2.6), drip: rnd(10, 36) * k, blobs })
    }
  }
  update(dt: number) {
    for (const p of this.ps) {
      p.life += dt
      p.vy += p.g * dt
      if (p.drag) {
        const d = Math.exp(-p.drag * dt)
        p.vx *= d
        p.vy *= p.k === 'smoke' || p.k === 'bubble' ? d : 1
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      p.size += p.grow * dt
    }
    this.ps = this.ps.filter((p) => p.life < p.max)
    for (const r of this.rings) {
      r.life += dt
      r.r += r.vr * dt
      r.vr *= Math.exp(-2.2 * dt)
    }
    this.rings = this.rings.filter((r) => r.life < r.max)
    for (const s of this.splats) s.life += dt
    this.splats = this.splats.filter((s) => s.life < s.max)
  }
  clear() {
    this.ps = []
    this.rings = []
    this.splats = []
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.ps) {
      const a = 1 - p.life / p.max
      ctx.save()
      ctx.translate(p.x, p.y)
      switch (p.k) {
        case 'spark':
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = Math.min(1, a * 1.6)
          ctx.strokeStyle = p.color
          ctx.lineWidth = Math.max(1, p.size * 0.6 * a)
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(-p.vx * 0.035, -p.vy * 0.035)
          ctx.stroke()
          break
        case 'star':
        case 'confetti': {
          ctx.rotate(p.rot)
          ctx.globalAlpha = Math.min(1, a * 2)
          ctx.fillStyle = p.color
          if (p.k === 'star') {
            ctx.beginPath()
            star4(ctx, 0, 0, p.size * (0.5 + a * 0.5), 0.28)
            ctx.fill()
          } else {
            ctx.scale(1, Math.abs(Math.sin(p.life * 9 + p.rot)))
            ctx.fillRect(-p.size * 0.6, -p.size * 0.35, p.size * 1.2, p.size * 0.7)
          }
          break
        }
        case 'goo':
          ctx.globalAlpha = Math.min(1, a * 3)
          ctx.fillStyle = p.color
          ctx.strokeStyle = '#170a24'
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, TAU)
          ctx.fill()
          ctx.stroke()
          break
        case 'smoke':
          ctx.globalAlpha = a * 0.35
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, TAU)
          ctx.fill()
          break
        case 'bubble':
          ctx.globalAlpha = Math.min(1, a * 2) * 0.8
          ctx.strokeStyle = '#ffffffcc'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, TAU)
          ctx.stroke()
          break
        case 'dust':
          ctx.globalAlpha = a * 0.5
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, TAU)
          ctx.fill()
          break
      }
      ctx.restore()
    }
    for (const r of this.rings) {
      const a = 1 - r.life / r.max
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = a
      ctx.strokeStyle = r.color
      ctx.lineWidth = r.w * a + 1
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.r, 0, TAU)
      ctx.stroke()
      ctx.restore()
    }
  }
  drawSplats(ctx: CanvasRenderingContext2D) {
    for (const s of this.splats) {
      const k = s.life / s.max
      const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
      const slide = s.drip * k * k
      ctx.save()
      ctx.globalAlpha = a * 0.92
      ctx.translate(s.x, s.y + slide)
      const pop = Math.min(1, s.life / 0.12)
      ctx.scale(pop, pop)
      ctx.fillStyle = s.color
      ctx.strokeStyle = '#170a24'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, s.r, 0, TAU)
      for (const b of s.blobs) {
        ctx.moveTo(b.dx + b.r, b.dy)
        ctx.arc(b.dx, b.dy, b.r, 0, TAU)
      }
      ctx.stroke()
      ctx.fill()
      // drip tail
      ctx.beginPath()
      ctx.ellipse(0, s.r * 0.6 + slide * 0.5, s.r * 0.22, s.r * 0.6 + slide * 0.5, 0, 0, TAU)
      ctx.fill()
      // glossy dot
      ctx.fillStyle = 'rgba(255,255,255,.55)'
      ctx.beginPath()
      ctx.ellipse(-s.r * 0.3, -s.r * 0.35, s.r * 0.22, s.r * 0.13, -0.6, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
  }
}
