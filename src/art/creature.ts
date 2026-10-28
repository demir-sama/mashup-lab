import { PALETTES, INK } from '../core/palettes'
import { PARTS_BY_SLOT, SLOTS, type Slot } from '../core/parts'
import type { Genome } from '../core/genome'
import { Rng } from '../core/rng'
import { rgba, ellipse, star4, rGrad, mix, TAU, type Ctx, type Pt } from './draw'
import { drawBody } from './bodies'
import { drawHead } from './head'
import { drawEyes, drawMouth } from './face'
import { LIMBS_BACK, LIMBS_FRONT } from './limbs'
import { TAILS } from './tails'
import { AURA_BACK, AURA_FRONT } from './auras'
import type { Mood, Rig } from './rig'

export type { Mood }

export const SIZE_SCALE = [0.8, 1, 1.18]

export interface DrawOpts {
  t?: number
  wob?: number
  look?: Pt
  blink?: number
  mood?: Mood
  /** vertical squash (<1) / stretch (>1) with volume preservation */
  squash?: number
  flip?: boolean
  /** draw the ground shadow */
  shadow?: boolean
  fancy?: boolean
  /** extra uniform scale */
  scale?: number
  /** draw an outline glow (selected) */
  glow?: string
  alpha?: number
  /** hide aura layers (tiny thumbs) */
  noAura?: boolean
}

function idOf(slot: Slot, g: Genome): string {
  return PARTS_BY_SLOT[slot][g.parts[slot]].id
}

const rigCache = new Map<string, (i: number) => number>()
function rndFor(seed: number) {
  const key = String(seed)
  let f = rigCache.get(key)
  if (!f) {
    const cache: number[] = []
    f = (i: number) => {
      if (cache[i] === undefined) cache[i] = new Rng(seed * 131 + i * 977).next()
      return cache[i]
    }
    if (rigCache.size > 300) rigCache.clear()
    rigCache.set(key, f)
  }
  return f
}

/** Natural blink schedule from time + creature seed (0..1). */
export function blinkAt(t: number, seed: number): number {
  const period = 3.2 + (seed % 7) * 0.35
  const ph = (t + (seed % 13) * 0.37) % period
  if (ph < 0.14) return Math.sin((ph / 0.14) * Math.PI)
  return 0
}

/**
 * Draw a creature with its feet at (0,0) in local space. The caller sets up translate/scale.
 * Local extent is roughly x:-170..170, y:-290..30.
 */
export function drawCreature(ctx: Ctx, g: Genome, o: DrawOpts = {}) {
  const t = o.t ?? 0
  const pal = PALETTES[g.hue % PALETTES.length]
  const rig: Rig = {
    g,
    pal,
    t,
    wob: o.wob ?? 0,
    look: o.look ?? { x: Math.sin(t * 0.7) * 0.45, y: Math.cos(t * 0.5) * 0.15 },
    blink: o.blink ?? blinkAt(t, g.seed),
    mood: o.mood ?? 'idle',
    rnd: rndFor(g.seed),
    fancy: o.fancy ?? true,
  }
  const ids = {} as Record<Slot, string>
  for (const s of SLOTS) ids[s] = idOf(s, g)

  ctx.save()
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha
  const sz = SIZE_SCALE[g.size] * (o.scale ?? 1)
  const breathe = Math.sin(t * 2.4 + g.seed) * 0.018
  const sq = (o.squash ?? 1) * (1 + breathe)
  const sx = (o.flip ? -1 : 1) * sz * (1 / Math.sqrt(sq))
  const sy = sz * sq
  const bounce = Math.abs(Math.sin(t * 1.2 + g.seed)) * 2

  if (o.shadow !== false) {
    ctx.save()
    ctx.fillStyle = rgba(INK, 0.28)
    ctx.beginPath()
    ellipse(ctx, 0, 3, 98 * sz * (1 - bounce * 0.01), 15 * sz)
    ctx.fill()
    ctx.restore()
  }

  ctx.scale(sx, sy)
  ctx.translate(0, -bounce)

  const hasAura = !o.noAura && ids.aura !== 'none'
  if (hasAura) AURA_BACK[ids.aura]?.(ctx, rig)
  if (o.glow) glowRing(ctx, o.glow, t)

  const dry = drawBody(ctx, { ...rig, dry: true }, ids.body)
  TAILS[ids.tail]?.(ctx, rig, dry)
  LIMBS_BACK[ids.limbs]?.(ctx, rig, dry)
  const body = drawBody(ctx, rig, ids.body)
  LIMBS_FRONT[ids.limbs]?.(ctx, rig, body)

  const head = drawHead(ctx, rig, ids.head, body.headY)
  const skull = ids.head === 'skull'
  const fx = 0
  const faceY = ids.head === 'bare' ? body.faceY : head.faceY
  const faceW = ids.head === 'bare' ? body.faceW : head.faceW
  const crown = ids.head === 'bare' ? body.top + 12 : head.crownY
  drawEyes(ctx, rig, ids.eyes, fx, faceY, faceW, crown, skull)
  if (!skull) drawMouth(ctx, rig, fx, faceY, faceW, ids.eyes)

  if (hasAura) AURA_FRONT[ids.aura]?.(ctx, rig)
  if (g.shiny) shinySparkles(ctx, rig)
  ctx.restore()
}

function shinySparkles(ctx: Ctx, rig: Rig) {
  for (let i = 0; i < 5; i++) {
    const ph = (rig.t * 0.9 + i * 0.37) % 1.6
    if (ph > 1) continue
    const sc = Math.sin(ph * Math.PI)
    const a = rig.rnd(i + 90) * TAU
    const x = Math.cos(a) * (50 + rig.rnd(i + 99) * 50)
    const y = -100 + Math.sin(a) * (60 + rig.rnd(i + 110) * 70)
    ctx.beginPath()
    star4(ctx, x, y, 5 + sc * 13, 0.2)
    ctx.fillStyle = '#fffbe0'
    ctx.fill()
  }
}

function glowRing(ctx: Ctx, color: string, t: number) {
  const g = rGrad(ctx, 0, -100, 40, 190, [[0, rgba(color, 0.0)], [0.6, rgba(color, 0.25 + Math.sin(t * 4) * 0.05)], [1, rgba(color, 0)]])
  ctx.fillStyle = g
  ctx.beginPath()
  ellipse(ctx, 0, -100, 190, 190)
  ctx.fill()
}
void mix
