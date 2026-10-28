import { drawCreature, blinkAt } from '../art/creature'
import { clamp, lerp, mix, lighten, darken, rgba, TAU, star4, easeOutCubic } from '../art/draw'
import { genomeOf, type Creature } from '../core/creature'
import { PALETTES, INK } from '../core/palettes'
import { POD_BY_ID, type PodDef } from '../core/pods'
import { RARITY_INFO, rarityRank } from '../core/fright'
import { Fx } from './fx'
import { sfx, machineLoop, boom, setIntensity } from '../audio/audio'
import { haptic } from '../platform/sdk'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export interface StageLayout {
  a: Rect
  b: Rect
  child: Rect
  tank: Rect
  W: number
  H: number
}
export interface FuseOpts {
  fast?: boolean
  reduced?: boolean
  guaranteeRank?: number
}

const easeOutBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2)
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
function elastic(t: number) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
}

interface Slot {
  c: Creature | null
  since: number
  prev: Creature | null
  prevAt: number
}
interface Fusion {
  a: Creature
  b: Creature
  child: Creature
  D: number
  t0: number
  boomAt: number
  rank: number
  reduced: boolean
  booms: boolean
  stopLoop: (() => void) | null
  cues: Set<string>
  resolve: () => void
  landed: boolean
  done: boolean
}

export class Stage {
  cv: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  W = 360
  H = 420
  dpr = 1
  pod: PodDef = POD_BY_ID.classic
  reduced = false
  fx = new Fx()
  slots: [Slot, Slot] = [
    { c: null, since: 0, prev: null, prevAt: 0 },
    { c: null, since: 0, prev: null, prevAt: 0 },
  ]
  child: Creature | null = null
  childAt = 0
  poke = { t: -10 }
  hover: 0 | 1 | 2 = 0 // 1 = slot a, 2 = slot b
  fusion: Fusion | null = null
  dip = 0
  dipTarget = 0
  flash = 0
  flashColor = '#ffffff'
  shake = 0
  zoom = 1
  lastT = 0
  time = 0
  raf = 0
  running = false
  bg: HTMLCanvasElement | null = null
  bgKey = ''
  onLayout?: (l: StageLayout) => void
  private lay!: StageLayout
  private ro?: ResizeObserver
  private shownLayout = ''

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv
    this.ctx = cv.getContext('2d')!
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(cv)
    this.resize()
  }

  destroy() {
    this.stop()
    this.ro?.disconnect()
  }

  start() {
    if (this.running) return
    this.running = true
    this.lastT = performance.now()
    const loop = (now: number) => {
      if (!this.running) return
      const dt = Math.min(0.05, (now - this.lastT) / 1000)
      this.lastT = now
      this.step(dt)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }
  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  resize() {
    const r = this.cv.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = Math.max(100, Math.round(r.width))
    const H = Math.max(100, Math.round(r.height))
    this.dpr = dpr
    this.W = W
    this.H = H
    this.cv.width = Math.round(W * dpr)
    this.cv.height = Math.round(H * dpr)
    this.bg = null
    this.computeLayout()
  }

  setPod(id: string) {
    this.pod = POD_BY_ID[id] ?? POD_BY_ID.classic
    this.bg = null
  }
  setReduced(v: boolean) {
    this.reduced = v
  }
  setHover(h: 0 | 1 | 2) {
    this.hover = h
  }

  setSlots(a: Creature | null, b: Creature | null) {
    const arr = [a, b]
    for (let i = 0; i < 2; i++) {
      const s = this.slots[i]
      if ((s.c?.id ?? '') !== (arr[i]?.id ?? '')) {
        s.prev = s.c
        s.prevAt = this.time
        s.c = arr[i]
        s.since = this.time
      }
    }
  }

  showChild(c: Creature | null) {
    if (c) {
      this.child = c
      this.childAt = this.time
      this.dipTarget = 1
    } else {
      this.child = null
      this.dipTarget = 0
    }
  }

  nudge() {
    this.poke.t = this.time
    sfx('boing')
    haptic('light')
    const l = this.lay
    this.fx.burst(l.child.x + l.child.w / 2, l.child.y + l.child.h * 0.3, 10, ['#fff3a8', '#ffd84a'], 220, 'star', 8)
  }

  // ---------- layout ----------
  private computeLayout() {
    const { W, H } = this
    const gY = H * 0.9
    const cs = this.cs()
    const pedH = H * 0.055
    const feetY = gY - pedH
    const cw = 150 * cs
    const ch = 300 * cs
    const xs = this.pedX()
    const tank = this.tankGeom()
    this.lay = {
      W,
      H,
      a: { x: xs[0] - cw / 2, y: feetY - ch, w: cw, h: ch + pedH },
      b: { x: xs[1] - cw / 2, y: feetY - ch, w: cw, h: ch + pedH },
      tank: { x: tank.cx - tank.w / 2, y: tank.top, w: tank.w, h: tank.bottom - tank.top },
      child: { x: W / 2 - ch * 0.5, y: gY - ch * 1.6, w: ch, h: ch * 1.6 },
    }
    const key = JSON.stringify(this.lay)
    if (key !== this.shownLayout) {
      this.shownLayout = key
      this.onLayout?.(this.lay)
    }
  }
  private cs() {
    return Math.min((this.H * 0.3) / 300, (this.W * 0.2) / 150)
  }
  private pedX(): [number, number] {
    const w = this.W
    const off = clamp(w * 0.33, 70, 330)
    return [w / 2 - off, w / 2 + off]
  }
  private tankGeom() {
    const { W, H } = this
    const w = clamp(W * 0.27, 96, 230)
    const bottom = H * 0.9 - H * 0.07
    const top = bottom - H * 0.44
    return { cx: W / 2, w, top, bottom }
  }

  // ---------- fusion ----------
  fuse(a: Creature, b: Creature, child: Creature, o: FuseOpts = {}): Promise<void> {
    this.finishNow()
    const reduced = o.reduced ?? this.reduced
    const D = o.fast ? 2.4 : reduced ? 2.2 : 5
    const rank = rarityRank(child.rarity)
    return new Promise((resolve) => {
      this.fusion = {
        a,
        b,
        child,
        D,
        t0: this.time,
        boomAt: D * 0.8,
        rank,
        reduced,
        booms: !reduced,
        stopLoop: null,
        cues: new Set(),
        resolve,
        landed: false,
        done: false,
      }
      this.slots[0].prev = this.slots[0].c
      this.slots[1].prev = this.slots[1].c
      this.child = null
      this.dipTarget = 0
    })
  }

  skip() {
    const f = this.fusion
    if (!f || this.time - f.t0 >= f.boomAt) return
    f.t0 = this.time - f.boomAt
  }

  /** instantly complete a running fusion (used when a new one starts / on teardown) */
  finishNow() {
    const f = this.fusion
    if (!f) return
    f.stopLoop?.()
    f.done = true
    this.fusion = null
    this.child = f.child
    this.dipTarget = 1
    this.dip = 1
    f.resolve()
  }

  inFusion() {
    return !!this.fusion
  }

  // ---------- frame ----------
  private step(dt: number) {
    this.time += dt
    this.updateFusion(dt)
    this.dip += (this.dipTarget - this.dip) * (1 - Math.exp(-dt * 6))
    this.flash = Math.max(0, this.flash - dt * (this.reduced ? 2.5 : 1.7))
    this.shake = Math.max(0, this.shake - dt * 24)
    this.zoom += (1 - this.zoom) * (1 - Math.exp(-dt * 7))
    this.ambient(dt)
    this.fx.update(dt)
    this.draw()
  }

  private ambient(dt: number) {
    const { W, H } = this
    if (Math.random() < dt * 2.2) this.fx.add({ k: 'dust', x: Math.random() * W, y: H * (0.2 + Math.random() * 0.65), vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 6, max: 4 + Math.random() * 3, size: 1 + Math.random() * 1.6, color: this.pod.glow })
    // tank bubbles
    const t = this.tankGeom()
    const f = this.fusion
    const rate = f && !f.landed ? 14 : 1.6
    if (Math.random() < dt * rate && this.dip < 0.6) this.fx.add({ k: 'bubble', x: t.cx + (Math.random() - 0.5) * t.w * 0.6, y: t.bottom - 6, vy: -40 - Math.random() * 40, max: 1.2 + Math.random(), size: 2 + Math.random() * 4, color: '#fff' })
  }

  private updateFusion(dt: number) {
    const f = this.fusion
    if (!f) return
    const T = this.time - f.t0
    const fr = T / f.D
    const L = this.lay
    const tg = this.tankGeom()
    const cue = (k: string, at: number, fn: () => void) => {
      if (!f.cues.has(k) && T >= at) {
        f.cues.add(k)
        fn()
      }
    }
    cue('whoosh', 0.02, () => {
      sfx('whoosh')
      haptic('light')
    })
    cue('absorb', f.D * 0.14, () => {
      sfx('clank')
      haptic('medium')
      this.fx.ring(tg.cx, tg.top, this.pod.glow, 420, 0.6, 8)
      this.fx.burst(tg.cx, tg.top, f.reduced ? 8 : 26, [PALETTES[genomeOf(f.a).hue % PALETTES.length].light, PALETTES[genomeOf(f.b).hue % PALETTES.length].light, '#fff'], 260)
    })
    cue('loop', f.D * 0.14, () => {
      if (f.boomAt - T > 0.3) f.stopLoop = machineLoop(Math.max(0.5, f.boomAt - f.D * 0.14 - f.D * 0.08))
      setIntensity(1)
    })
    // churn effects
    if (fr > 0.14 && fr < 0.72) {
      const k = (fr - 0.14) / 0.58
      if (!f.reduced) this.shake = Math.max(this.shake, 1.2 + k * 5)
      this.zoom = Math.max(this.zoom, 1 + k * 0.05)
      if (Math.random() < dt * (10 + k * 40)) {
        const side = Math.random() < 0.5 ? -1 : 1
        this.fx.add({ k: 'spark', x: tg.cx + side * tg.w * 0.5, y: tg.top + Math.random() * (tg.bottom - tg.top), vx: side * (60 + Math.random() * 160), vy: -60 - Math.random() * 100, g: 300, max: 0.5, size: 4, color: Math.random() < 0.5 ? '#fff6a8' : this.pod.glow })
      }
      if (Math.random() < dt * (3 + k * 8)) this.fx.add({ k: 'smoke', x: tg.cx + (Math.random() - 0.5) * tg.w * 0.4, y: tg.top - 6, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 40, size: 8, grow: 24, max: 1.2, color: '#d9d0ee', drag: 1 })
      if (!f.reduced && Math.random() < dt * 6 * (0.3 + k)) haptic('light')
      const tick = Math.floor(T * (3 + k * 9))
      if (tick !== (f as any)._tick) {
        ;(f as any)._tick = tick
        if (k > 0.1) sfx('tick')
      }
    }
    if (fr >= 0.72 && fr < 0.8) {
      this.shake = 0
      cue('hold', f.D * 0.72, () => {
        f.stopLoop?.()
        setIntensity(0.2)
      })
    }
    cue('boom', f.boomAt, () => this.doBoom(f))
    if (T >= f.boomAt) {
      const tp = clamp((T - f.boomAt) / 0.95, 0, 1)
      if (tp > 0.62 && !f.landed) {
        f.landed = true
        sfx('boing')
        haptic(f.rank >= 3 ? 'success' : 'medium')
        const gY = this.H * 0.9
        this.fx.burst(this.W / 2, gY - 4, 14, ['#d9d0ee', '#fff'], 200, 'dust', 7)
        this.fx.ring(this.W / 2, gY - 4, RARITY_INFO[f.child.rarity].glow, 360, 0.5, 6)
        if (!f.reduced) this.shake = Math.max(this.shake, 3 + f.rank)
        this.zoom = 1.03
      }
      if (T >= f.boomAt + (f.reduced ? 0.5 : 1.15)) {
        this.fusion = null
        this.child = f.child
        this.childAt = this.time - 1
        this.dipTarget = 1
        setIntensity(0.4)
        f.done = true
        f.resolve()
      }
    }
  }

  private doBoom(f: Fusion) {
    const info = RARITY_INFO[f.child.rarity]
    const tg = this.tankGeom()
    const cx = tg.cx
    const cy = (tg.top + tg.bottom) / 2
    boom(Math.min(4, f.rank) as 0 | 1 | 2 | 3 | 4)
    sfx('splat')
    haptic(f.rank >= 3 ? 'heavy' : 'medium')
    const cols = [info.color, info.glow, '#fff6a8', this.pod.goo, '#ffffff']
    if (f.booms) {
      this.flash = 1
      this.flashColor = f.rank >= 4 ? '#fffbe0' : '#ffffff'
      this.shake = 10 + f.rank * 5
      this.zoom = 1.1
    } else {
      this.flash = 0.45
      this.flashColor = info.glow
    }
    const n = f.booms ? 1 : 0.35
    for (let i = 0; i <= Math.min(3, f.rank + 1); i++) this.fx.ring(cx, cy, i % 2 ? info.glow : '#fff', 380 + i * 170, 0.7 + i * 0.12, 14 - i * 2)
    this.fx.burst(cx, cy, Math.round((40 + f.rank * 22) * n), cols, 640)
    this.fx.burst(cx, cy, Math.round((22 + f.rank * 14) * n), [this.pod.goo, mix(this.pod.goo, '#fff', 0.4)], 520, 'goo', 7)
    this.fx.burst(cx, cy - 20, Math.round((24 + f.rank * 30) * n), cols, 480, 'star', 12)
    for (let i = 0; i < Math.round((18 + f.rank * 30) * n); i++) {
      this.fx.add({ k: 'confetti', x: Math.random() * this.W, y: -10 - Math.random() * this.H * 0.3, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 120, g: 30, max: 2.4 + Math.random() * 1.6, size: 8 + Math.random() * 8, color: cols[i % cols.length], rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10 })
    }
    this.fx.splat(this.W, this.H, this.pod.goo, Math.round((5 + f.rank * 1.5) * n))
  }

  // ---------- drawing ----------
  private drawBg() {
    const key = `${this.pod.id}|${this.W}|${this.H}|${this.dpr}`
    if (this.bg && this.bgKey === key) return
    const { W, H, dpr } = this
    const c = document.createElement('canvas')
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    const x = c.getContext('2d')!
    x.scale(dpr, dpr)
    const p = this.pod
    const g = x.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, p.bg1)
    g.addColorStop(1, p.bg2)
    x.fillStyle = g
    x.fillRect(0, 0, W, H)
    // brick wall
    x.strokeStyle = rgba('#000000', 0.12)
    x.lineWidth = 1.5
    const bh = 26
    for (let y = 0, r = 0; y < H * 0.9; y += bh, r++) {
      x.beginPath()
      x.moveTo(0, y)
      x.lineTo(W, y)
      x.stroke()
      for (let bx = r % 2 ? 0 : -36; bx < W; bx += 72) {
        x.beginPath()
        x.moveTo(bx, y)
        x.lineTo(bx, y + bh)
        x.stroke()
      }
    }
    // moon
    const mr = Math.min(W, H) * 0.12
    const mx = W * 0.82
    const my = H * 0.17
    const mg = x.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 2.6)
    mg.addColorStop(0, rgba(p.glow, 0.45))
    mg.addColorStop(1, rgba(p.glow, 0))
    x.fillStyle = mg
    x.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6)
    x.fillStyle = mix(p.glow, '#ffffff', 0.55)
    x.strokeStyle = INK
    x.lineWidth = 4
    x.beginPath()
    x.arc(mx, my, mr, 0, TAU)
    x.fill()
    x.stroke()
    x.fillStyle = rgba(p.metalDark, 0.25)
    for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.4, 0.12]]) {
      x.beginPath()
      x.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU)
      x.fill()
    }
    // shelf with jars
    const shelfY = H * 0.3
    for (const sx of [W * 0.04, W * 0.56]) {
      const sw = W * 0.26
      x.fillStyle = darken(p.metalDark, 0.3)
      x.strokeStyle = INK
      x.lineWidth = 3
      x.fillRect(sx, shelfY, sw, 8)
      x.strokeRect(sx, shelfY, sw, 8)
      let jx = sx + 10
      let i = 0
      while (jx < sx + sw - 24) {
        const jw = 16 + ((i * 7) % 9)
        const jh = 22 + ((i * 13) % 16)
        x.fillStyle = rgba(mix(p.glow, '#ffffff', 0.2), 0.16)
        x.strokeStyle = rgba(INK, 0.8)
        x.lineWidth = 2.5
        x.beginPath()
        x.roundRect(jx, shelfY - jh, jw, jh, 5)
        x.fill()
        x.stroke()
        x.fillStyle = rgba([p.goo, p.glow, p.trim][i % 3], 0.55)
        x.fillRect(jx + 2, shelfY - jh * 0.6, jw - 4, jh * 0.6 - 2)
        if (i % 3 === 0) {
          x.fillStyle = '#fff'
          x.beginPath()
          x.arc(jx + jw * 0.35, shelfY - jh * 0.35, 2.4, 0, TAU)
          x.arc(jx + jw * 0.65, shelfY - jh * 0.35, 2.4, 0, TAU)
          x.fill()
          x.fillStyle = INK
          x.beginPath()
          x.arc(jx + jw * 0.35, shelfY - jh * 0.35, 1.1, 0, TAU)
          x.arc(jx + jw * 0.65, shelfY - jh * 0.35, 1.1, 0, TAU)
          x.fill()
        }
        jx += jw + 8
        i++
      }
    }
    // floor
    const gY = H * 0.9
    const fg = x.createLinearGradient(0, gY - 6, 0, H)
    fg.addColorStop(0, darken(p.bg1, 0.35))
    fg.addColorStop(1, darken(p.bg2, 0.5))
    x.fillStyle = fg
    x.fillRect(0, gY - 6, W, H - gY + 6)
    x.fillStyle = INK
    x.fillRect(0, gY - 8, W, 5)
    x.strokeStyle = rgba('#000', 0.25)
    x.lineWidth = 2
    for (let i = -8; i < 20; i++) {
      x.beginPath()
      x.moveTo(W / 2 + i * W * 0.16, gY)
      x.lineTo(W / 2 + i * W * 0.5, H)
      x.stroke()
    }
    // vignette
    const vg = x.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.5)')
    x.fillStyle = vg
    x.fillRect(0, 0, W, H)
    this.bg = c
    this.bgKey = key
  }

  private draw() {
    const { ctx, W, H, dpr } = this
    this.drawBg()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.drawImage(this.bg!, 0, 0, W, H)
    const t = this.time
    const f = this.fusion
    this.drawAmbientDeco(t, f)
    // camera
    ctx.save()
    const sh = this.shake
    const sx = sh ? (Math.random() - 0.5) * sh * 2 : 0
    const sy = sh ? (Math.random() - 0.5) * sh * 2 : 0
    ctx.translate(W / 2 + sx, H * 0.6 + sy)
    ctx.scale(this.zoom, this.zoom)
    ctx.translate(-W / 2, -H * 0.6)

    const rev = this.child || (f && t - f.t0 >= f.boomAt) ? true : false
    if (rev) this.drawSunburst(f ? f.child : this.child!)
    this.drawPipes(f)
    this.drawPedestals()
    this.drawSlotCreatures(f)
    this.drawTank(f)
    if (f) this.drawFusionActors(f)
    else if (this.child) this.drawChild(this.child, 1, 1, 0)
    this.fx.draw(ctx)
    ctx.restore()

    // screen overlay: flash + splats
    this.fx.drawSplats(ctx)
    if (this.flash > 0) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, this.flash)
      ctx.fillStyle = this.flashColor
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }
  }

  private drawAmbientDeco(t: number, f: Fusion | null) {
    const { ctx, W, H } = this
    // lamps
    const flicker = f && t - f.t0 > f.D * 0.14 && t - f.t0 < f.boomAt ? 0.5 + 0.5 * Math.sin(t * 40) : 1
    for (const lx of [W * 0.3, W * 0.7]) {
      const sw = Math.sin(t * 1.3 + lx) * 0.05
      ctx.save()
      ctx.translate(lx, 0)
      ctx.rotate(sw)
      ctx.strokeStyle = INK
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, H * 0.09)
      ctx.stroke()
      const g = ctx.createRadialGradient(0, H * 0.11, 2, 0, H * 0.11, H * 0.28)
      g.addColorStop(0, rgba(this.pod.glow, 0.5 * flicker))
      g.addColorStop(1, rgba(this.pod.glow, 0))
      ctx.fillStyle = g
      ctx.fillRect(-H * 0.3, 0, H * 0.6, H * 0.4)
      ctx.fillStyle = this.pod.metalDark
      ctx.beginPath()
      ctx.moveTo(-14, H * 0.115)
      ctx.lineTo(-6, H * 0.09)
      ctx.lineTo(6, H * 0.09)
      ctx.lineTo(14, H * 0.115)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = mix(this.pod.glow, '#fff', 0.5 + 0.3 * flicker)
      ctx.beginPath()
      ctx.arc(0, H * 0.118, 6, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
    // bats
    if (!this.reduced) {
      for (let i = 0; i < 3; i++) {
        const per = 14 + i * 5
        const k = ((t + i * 6.3) % per) / per
        const bx = W * 1.1 - k * W * 1.3
        const by = H * (0.12 + i * 0.07) + Math.sin(t * 2.2 + i) * 14
        const fl = Math.sin(t * 14 + i * 2)
        ctx.save()
        ctx.translate(bx, by)
        ctx.scale(0.8 + i * 0.1, 0.8 + i * 0.1)
        ctx.fillStyle = INK
        ctx.beginPath()
        ctx.ellipse(0, 0, 7, 9, 0, 0, TAU)
        ctx.fill()
        for (const s of [-1, 1]) {
          ctx.beginPath()
          ctx.moveTo(s * 4, -2)
          ctx.quadraticCurveTo(s * 18, -14 - fl * 10, s * 30, -4 + fl * 8)
          ctx.quadraticCurveTo(s * 24, 0 + fl * 4, s * 20, 4)
          ctx.quadraticCurveTo(s * 14, 0, s * 10, 6)
          ctx.quadraticCurveTo(s * 7, 2, s * 4, 4)
          ctx.closePath()
          ctx.fill()
        }
        ctx.beginPath()
        ctx.moveTo(-5, -7)
        ctx.lineTo(-3, -13)
        ctx.lineTo(0, -8)
        ctx.lineTo(3, -13)
        ctx.lineTo(5, -7)
        ctx.fill()
        ctx.restore()
      }
    }
  }

  private drawSunburst(c: Creature) {
    const { ctx, W, H } = this
    const info = RARITY_INFO[c.rarity]
    const r = rarityRank(c.rarity)
    const k = clamp(this.dip, 0, 1)
    if (k < 0.02) return
    const cx = W / 2
    const cy = H * 0.9 - this.cs() * 300 * 0.75
    ctx.save()
    ctx.globalAlpha = k * (0.35 + r * 0.07)
    ctx.translate(cx, cy)
    const n = 16
    const spin = this.reduced ? 0 : this.time * (0.12 + r * 0.04)
    const R = Math.hypot(W, H)
    for (let i = 0; i < n; i++) {
      const a = spin + (i / n) * TAU
      ctx.fillStyle = i % 2 ? rgba(info.color, 0.55) : rgba(info.glow, 0.25)
      if (c.rarity === 'mythic') ctx.fillStyle = `hsla(${(i * 47 + this.time * 60) % 360},95%,65%,0.45)`
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a - 0.08) * R, Math.sin(a - 0.08) * R)
      ctx.lineTo(Math.cos(a + 0.08) * R, Math.sin(a + 0.08) * R)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, H * 0.5)
    g.addColorStop(0, rgba(info.glow, 0.7))
    g.addColorStop(1, rgba(info.glow, 0))
    ctx.fillStyle = g
    ctx.fillRect(-W, -H, W * 2, H * 2)
    ctx.restore()
    // ambient stars for rare+
    if (r >= 2 && !this.reduced && Math.random() < 0.25) {
      this.fx.add({ k: 'star', x: cx + (Math.random() - 0.5) * W * 0.6, y: cy + (Math.random() - 0.3) * H * 0.4, vy: -30, max: 1.1, size: 5 + Math.random() * 7, color: info.glow, rot: Math.random() * 3, vr: 2 })
    }
  }

  private drawPipes(f: Fusion | null) {
    const { ctx } = this
    const tg = this.tankGeom()
    const xs = this.pedX()
    const gY = this.H * 0.9
    const pedY = gY - this.H * 0.03
    const p = this.pod
    const alpha = 1 - this.dip * 0.6
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(0, this.dip * this.H * 0.22)
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1
      const x0 = xs[i]
      const x1 = tg.cx + s * tg.w * 0.45
      const y1 = tg.bottom - this.H * 0.07
      const pts = [] as { x: number; y: number }[]
      for (let k = 0; k <= 16; k++) {
        const q = k / 16
        pts.push({ x: lerp(x0, x1, q), y: lerp(pedY, y1, easeInOut(q)) - Math.sin(q * Math.PI) * this.H * 0.05 })
      }
      const draw = (w: number, col: string) => {
        ctx.strokeStyle = col
        ctx.lineWidth = w
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        pts.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
        ctx.stroke()
      }
      draw(17, INK)
      draw(11, p.metal)
      draw(4, lighten(p.metal, 0.4))
      // flow dots
      if (f) {
        const T = this.time - f.t0
        const act = clamp((T - f.D * 0.02) / (f.D * 0.12), 0, 1) * (1 - clamp((T - f.boomAt + 0.2) / 0.3, 0, 1))
        if (act > 0) {
          ctx.fillStyle = p.goo
          for (let k = 0; k < 5; k++) {
            const q = (((T * 1.6 + k / 5) % 1) + 1) % 1
            const pt = pts[Math.round(q * 16)]
            const rr = 4 + Math.sin(q * Math.PI) * 3
            ctx.globalAlpha = act * alpha
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, rr, 0, TAU)
            ctx.fill()
          }
        }
      }
    }
    ctx.restore()
  }

  private drawPedestals() {
    const { ctx } = this
    const xs = this.pedX()
    const gY = this.H * 0.9
    const ph = this.H * 0.055
    const pw = this.cs() * 150
    const p = this.pod
    for (let i = 0; i < 2; i++) {
      const x = xs[i]
      const occ = !!this.slots[i].c
      const hov = this.hover === i + 1
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3 + i)
      // glow
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const g = ctx.createRadialGradient(x, gY - ph, 4, x, gY - ph, pw * (hov ? 1.5 : 1.1))
      g.addColorStop(0, rgba(p.glow, hov ? 0.7 : occ ? 0.4 : 0.18 + pulse * 0.1))
      g.addColorStop(1, rgba(p.glow, 0))
      ctx.fillStyle = g
      ctx.fillRect(x - pw * 1.6, gY - ph - pw, pw * 3.2, pw * 2)
      ctx.restore()
      // body
      ctx.fillStyle = p.metalDark
      ctx.strokeStyle = INK
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(x - pw * 0.62, gY)
      ctx.lineTo(x - pw * 0.5, gY - ph)
      ctx.lineTo(x + pw * 0.5, gY - ph)
      ctx.lineTo(x + pw * 0.62, gY)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = p.metal
      ctx.beginPath()
      ctx.ellipse(x, gY - ph, pw * 0.5, ph * 0.38, 0, 0, TAU)
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = rgba(p.glow, hov ? 1 : 0.55 + pulse * 0.3 * (occ ? 0 : 1))
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(x, gY - ph, pw * 0.38, ph * 0.26, 0, 0, TAU)
      ctx.stroke()
      // empty slot hint
      if (!occ && !this.fusion && this.dip < 0.3) {
        const by = gY - ph - this.cs() * 120 + Math.sin(this.time * 2.6 + i) * 5
        ctx.save()
        ctx.setLineDash([9, 8])
        ctx.lineDashOffset = -this.time * 18
        ctx.lineWidth = 4
        ctx.strokeStyle = rgba(p.glow, hov ? 1 : 0.65)
        ctx.fillStyle = rgba(p.glow, hov ? 0.22 : 0.08)
        ctx.beginPath()
        ctx.ellipse(x, by, pw * 0.45, this.cs() * 105, 0, 0, TAU)
        ctx.fill()
        ctx.stroke()
        ctx.setLineDash([])
        ctx.font = `${Math.round(this.cs() * 120)}px "Lilita One", Impact, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = rgba(p.glow, hov ? 1 : 0.85)
        ctx.strokeStyle = INK
        ctx.lineWidth = 6
        ctx.lineJoin = 'round'
        const lab = i === 0 ? 'A' : 'B'
        ctx.strokeText(lab, x, by + 4)
        ctx.fillText(lab, x, by + 4)
        ctx.restore()
      }
    }
  }

  private drawSlotCreatures(f: Fusion | null) {
    const { ctx } = this
    const xs = this.pedX()
    const feetY = this.H * 0.9 - this.H * 0.055
    const cs = this.cs()
    for (let i = 0; i < 2; i++) {
      const s = this.slots[i]
      if (f) continue // actors draw them
      // leaving creature (swapped out / removed)
      if (s.prev && this.time - s.prevAt < 0.22) {
        const q = (this.time - s.prevAt) / 0.22
        ctx.save()
        ctx.translate(xs[i], feetY - q * 30)
        ctx.scale(cs, cs)
        drawCreature(ctx, genomeOf(s.prev), { t: this.time, alpha: 1 - q, flip: i === 1, mood: 'scared', scale: 1 - q * 0.2, shadow: false })
        ctx.restore()
      }
      if (!s.c) continue
      const age = this.time - s.since
      const drop = age < 0.5 ? (1 - easeOutBack(clamp(age / 0.5, 0, 1))) * -90 : 0
      const sq = age < 0.55 ? 1 + Math.sin(clamp(age / 0.55, 0, 1) * Math.PI * 2.5) * 0.12 * (1 - age / 0.55) - (age > 0.18 && age < 0.3 ? 0.18 : 0) : 1
      const g = genomeOf(s.c)
      ctx.save()
      ctx.translate(xs[i], feetY + drop)
      ctx.scale(cs, cs)
      const look = { x: (i === 0 ? 1 : -1) * 0.7, y: 0.05 }
      drawCreature(ctx, g, { t: this.time + i * 1.7, squash: sq, flip: i === 1, look, mood: this.hover === i + 1 ? 'happy' : 'idle', blink: blinkAt(this.time, g.seed), glow: this.hover === i + 1 ? this.pod.glow : undefined })
      ctx.restore()
    }
  }

  private drawFusionActors(f: Fusion) {
    const { ctx } = this
    const T = this.time - f.t0
    const fr = T / f.D
    const xs = this.pedX()
    const feetY = this.H * 0.9 - this.H * 0.055
    const cs = this.cs()
    const tg = this.tankGeom()
    // parents leaping into the machine
    if (fr < 0.145) {
      const q = easeInOut(clamp(fr / 0.14, 0, 1))
      const pre = clamp(T / 0.22, 0, 1) // crouch before jump
      ;[f.a, f.b].forEach((c, i) => {
        const x0 = xs[i]
        const tx = tg.cx
        const ty = tg.top + 8
        const x = lerp(x0, tx, q)
        const y = lerp(feetY, ty, q) - Math.sin(q * Math.PI) * this.H * 0.22
        const sc = lerp(1, 0.25, q * q)
        const crouch = q === 0 ? 1 - Math.sin(pre * Math.PI) * 0.25 : 1 + (1 - q) * 0.2
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(q * TAU * (i === 0 ? 1 : -1))
        ctx.scale(cs * sc, cs * sc)
        drawCreature(ctx, genomeOf(c), { t: this.time, squash: crouch, mood: 'scared', shadow: q < 0.05, flip: i === 1 })
        ctx.restore()
        if (q > 0 && q < 1 && Math.random() < 0.7) this.fx.add({ k: 'spark', x, y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, max: 0.4, size: 4, color: PALETTES[genomeOf(c).hue % PALETTES.length].light })
      })
    }
    // the new creature pops out
    if (T >= f.boomAt) {
      const tp = clamp((T - f.boomAt) / 0.95, 0, 1)
      this.drawChild(f.child, 1, tp, 1)
    }
  }

  /** `tp` is the pop-out progress 0..1; `mode` 1 = in flight. */
  private drawChild(c: Creature, _a: number, tp: number, mode: number) {
    const { ctx, W, H } = this
    const gY = H * 0.9 - 4
    const cs = this.cs()
    const scale = Math.min((H * 0.46) / 300, (W * 0.5) / 340)
    const tg = this.tankGeom()
    let x = W / 2
    let y = gY
    let sc = scale
    let squash = 1
    let rot = 0
    if (mode === 1) {
      const startY = (tg.top + tg.bottom) / 2 + 40
      y = lerp(startY, gY, tp * tp * (3 - 2 * tp)) - Math.sin(tp * Math.PI) * H * 0.3
      sc = scale * clamp(elastic(clamp(tp * 1.35, 0, 1)), 0, 1.15)
      squash = tp < 0.62 ? 1.12 : 1 - Math.sin(clamp((tp - 0.62) / 0.38, 0, 1) * Math.PI) * 0.22
      rot = (1 - tp) * 0.5
    } else {
      const age = this.time - this.childAt
      const pk = this.time - this.poke.t
      squash = pk < 0.5 ? 1 + Math.sin(pk * 24) * 0.14 * (1 - pk / 0.5) : 1
      y = gY - (pk < 0.4 ? Math.sin((pk / 0.4) * Math.PI) * 22 : 0)
      void age
    }
    const g = genomeOf(c)
    const mood = mode === 1 ? 'shout' : this.time - this.childAt < 1.2 ? 'shout' : 'happy'
    const info = RARITY_INFO[c.rarity]
    // spotlight beam + floor glow
    if (mode === 0 || tp > 0.5) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const gg = ctx.createRadialGradient(x, gY, 4, x, gY, scale * 170)
      gg.addColorStop(0, rgba(info.glow, 0.65))
      gg.addColorStop(1, rgba(info.glow, 0))
      ctx.fillStyle = gg
      ctx.beginPath()
      ctx.ellipse(x, gY, scale * 190, scale * 40, 0, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.scale(sc, sc)
    drawCreature(ctx, g, { t: this.time, squash, mood, look: { x: Math.sin(this.time * 0.9) * 0.3, y: -0.1 }, blink: blinkAt(this.time, g.seed), glow: c.rarity === 'common' ? undefined : info.glow })
    ctx.restore()
    void cs
  }

  private drawTank(f: Fusion | null) {
    const { ctx } = this
    const tg = this.tankGeom()
    const p = this.pod
    const T = f ? this.time - f.t0 : 0
    const fr = f ? T / f.D : 0
    const churn = f ? clamp((fr - 0.14) / 0.58, 0, 1) : 0
    const holdK = f ? clamp((fr - 0.72) / 0.08, 0, 1) * (T < f.boomAt ? 1 : 0) : 0
    const after = f ? T >= f.boomAt : false
    const idle = !f
    const level = idle ? 0.34 + Math.sin(this.time * 1.2) * 0.012 : after ? 0.1 : lerp(0.34, 0.92, easeInOut(churn))
    const bulge = 1 + holdK * 0.1 + (after ? 0 : 0)
    const rank = f ? f.rank : 0
    const dipY = this.dip * this.H * 0.22
    const jitter = f && churn > 0 && !after && !f.reduced ? churn * 2.4 : 0
    const jx = jitter ? (Math.random() - 0.5) * jitter * 2 : 0
    const jy = jitter ? (Math.random() - 0.5) * jitter : 0
    const gY = this.H * 0.9
    const bh = this.H * 0.07
    const th = tg.bottom - tg.top
    const tw = tg.w
    ctx.save()
    ctx.globalAlpha = 1 - this.dip * 0.55
    ctx.translate(tg.cx + jx, gY + dipY + jy)
    // base unit
    const bw = tw * 1.7
    ctx.fillStyle = p.metalDark
    ctx.strokeStyle = INK
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.roundRect(-bw / 2, -bh, bw, bh, 12)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = p.metal
    ctx.beginPath()
    ctx.roundRect(-bw / 2 + 5, -bh + 5, bw - 10, bh * 0.45, 8)
    ctx.fill()
    // chase lights
    const nL = 7
    for (let i = 0; i < nL; i++) {
      const on = f && !after ? (Math.floor(this.time * (6 + churn * 14)) + i) % 3 === 0 : (Math.floor(this.time * 2) + i) % 7 === 0
      ctx.fillStyle = on ? lighten(p.glow, 0.5) : darken(p.metalDark, 0.3)
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(-bw / 2 + 18 + (i * (bw - 36)) / (nL - 1), -bh * 0.3, bh * 0.1 + 1, 0, TAU)
      ctx.fill()
      ctx.stroke()
    }
    // pressure gauge
    const gx = 0
    const gy = -bh * 0.72
    ctx.fillStyle = '#fff7e0'
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(gx, gy, bh * 0.22, 0, TAU)
    ctx.fill()
    ctx.stroke()
    const need = f ? (after ? 0 : churn * 0.95 + holdK * 0.05) : 0.1 + Math.sin(this.time * 1.5) * 0.04
    const ang = Math.PI * (1.0 + need * 1.0)
    ctx.strokeStyle = '#e8283c'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx + Math.cos(ang) * bh * 0.18, gy + Math.sin(ang) * bh * 0.18)
    ctx.stroke()

    // tank body
    ctx.translate(0, -bh)
    ctx.scale(bulge, bulge)
    const R = tw / 2
    const path = new Path2D()
    path.moveTo(-R, 0)
    path.lineTo(-R, -th + R)
    path.arc(0, -th + R, R, Math.PI, 0)
    path.lineTo(R, 0)
    path.closePath()
    // back
    const bgG = ctx.createLinearGradient(-R, 0, R, 0)
    bgG.addColorStop(0, rgba(darken(p.glass, 0.5), 0.9))
    bgG.addColorStop(0.5, rgba(darken(p.glass, 0.65), 0.9))
    bgG.addColorStop(1, rgba(darken(p.glass, 0.45), 0.9))
    ctx.fillStyle = bgG
    ctx.fill(path)
    ctx.save()
    ctx.clip(path)
    // goo
    const gy0 = -th * level
    const lg = ctx.createLinearGradient(0, gy0, 0, 0)
    const gc = f && !after && fr > 0.55 ? mix(p.goo, RARITY_INFO[f.child.rarity].color, clamp((fr - 0.55) / 0.2, 0, 1) * 0.65) : p.goo
    lg.addColorStop(0, lighten(gc, 0.35))
    lg.addColorStop(0.25, gc)
    lg.addColorStop(1, darken(gc, 0.45))
    ctx.fillStyle = lg
    ctx.beginPath()
    ctx.moveTo(-R - 4, 6)
    ctx.lineTo(-R - 4, gy0)
    const amp = 3 + churn * 7
    for (let x = -R; x <= R + 4; x += 6) ctx.lineTo(x, gy0 + Math.sin(x * 0.12 + this.time * (3 + churn * 8)) * amp)
    ctx.lineTo(R + 4, 6)
    ctx.closePath()
    ctx.fill()
    // swirling parent essences
    if (f && !after && churn > 0) {
      const ca = PALETTES[genomeOf(f.a).hue % PALETTES.length]
      const cb = PALETTES[genomeOf(f.b).hue % PALETTES.length]
      ctx.globalAlpha = 0.85
      for (let i = 0; i < 2; i++) {
        const col = i ? cb : ca
        for (let k = 0; k < 4; k++) {
          const a = this.time * (2 + churn * 6) * (i ? -1 : 1) + k * 1.6 + i * Math.PI
          const rad = R * 0.5 * (1 - churn * 0.55) * (0.5 + 0.5 * Math.sin(k + this.time))
          ctx.fillStyle = k % 2 ? col.light : col.main
          ctx.strokeStyle = INK
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.arc(Math.cos(a) * rad, gy0 * 0.55 + Math.sin(a) * rad * 0.75 - 10, R * (0.16 + k * 0.025), 0, TAU)
          ctx.fill()
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }
    // charge glow telegraphing rarity near the end
    if (f && !after && fr > 0.5) {
      const info = RARITY_INFO[f.child.rarity]
      const k = clamp((fr - 0.5) / 0.3, 0, 1)
      const inten = (0.15 + rank * 0.14) * k * (0.7 + 0.3 * Math.sin(this.time * (14 + k * 20)))
      ctx.globalCompositeOperation = 'lighter'
      const gg = ctx.createRadialGradient(0, -th * 0.45, 4, 0, -th * 0.45, th * 0.6)
      gg.addColorStop(0, rgba(info.glow, Math.min(1, inten * 1.7)))
      gg.addColorStop(1, rgba(info.glow, 0))
      ctx.fillStyle = gg
      ctx.fillRect(-R, -th, tw, th)
      ctx.globalCompositeOperation = 'source-over'
    }
    // glass shine
    const sh = ctx.createLinearGradient(-R, 0, R, 0)
    sh.addColorStop(0, 'rgba(255,255,255,0)')
    sh.addColorStop(0.12, 'rgba(255,255,255,0.28)')
    sh.addColorStop(0.2, 'rgba(255,255,255,0)')
    sh.addColorStop(0.8, 'rgba(255,255,255,0)')
    sh.addColorStop(0.88, 'rgba(255,255,255,0.14)')
    sh.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sh
    ctx.fillRect(-R, -th, tw, th)
    ctx.restore()
    // outline + bands
    ctx.lineWidth = 6
    ctx.strokeStyle = INK
    ctx.stroke(path)
    ctx.lineWidth = 3
    ctx.strokeStyle = rgba('#fff', 0.35)
    ctx.beginPath()
    ctx.arc(0, -th + R, R - 8, Math.PI * 1.1, Math.PI * 1.45)
    ctx.stroke()
    for (const by of [-th * 0.06, -th * 0.55]) {
      ctx.fillStyle = p.trim
      ctx.strokeStyle = INK
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.roundRect(-R - 6, by - 8, tw + 12, 16, 6)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = rgba('#fff', 0.5)
      ctx.fillRect(-R, by - 5, tw, 3)
    }
    // cap + vent
    ctx.fillStyle = p.metal
    ctx.beginPath()
    ctx.roundRect(-R * 0.34, -th - 14, R * 0.68, 20, 7)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = p.trim
    ctx.beginPath()
    ctx.arc(0, -th - 18, 8, 0, TAU)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    void star4
    void easeOutCubic
  }

  // ---------- helpers for the UI ----------
  getLayout(): StageLayout {
    return this.lay
  }
  /** a still frame for tests/screenshots */
  advance(seconds: number) {
    const n = Math.ceil(seconds * 60)
    for (let i = 0; i < n; i++) this.step(1 / 60)
  }
}
