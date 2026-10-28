import { Rng } from './rng'
import {
  PARTS_BY_SLOT,
  PART_BY_KEY,
  RARITY_WEIGHT,
  SLOTS,
  STARTER_PART_KEYS,
  partKey,
  type PartDef,
  type Slot,
} from './parts'
import { PALETTE_COUNT, PATTERN_COUNT } from './palettes'

/** A creature's DNA. Tiny, serialisable, and enough to redraw the monster exactly. */
export interface Genome {
  /** index into PARTS_BY_SLOT[slot] */
  parts: Record<Slot, number>
  /** palette index */
  hue: number
  /** pattern index (0 plain) */
  pattern: number
  /** 0 small, 1 normal, 2 big */
  size: 0 | 1 | 2
  /** shiny / holo variant */
  shiny: boolean
  /** cosmetic seed (eye wobble, spots layout, ...) */
  seed: number
  /** how many slots mutated on the way here */
  mut: number
}

export function cloneGenome(g: Genome): Genome {
  return { ...g, parts: { ...g.parts } }
}

export function partOf(g: Genome, slot: Slot): PartDef {
  return PARTS_BY_SLOT[slot][g.parts[slot]]
}
export function partsOf(g: Genome): PartDef[] {
  return SLOTS.map((s) => partOf(g, s))
}
export function keyOf(g: Genome, slot: Slot): string {
  const p = partOf(g, slot)
  return partKey(p.slot, p.id)
}
export function partKeysOf(g: Genome): string[] {
  return SLOTS.map((s) => keyOf(g, s))
}
export function hasPart(g: Genome, key: string): boolean {
  return partKeysOf(g).includes(key)
}

// ---------- codes (used for share links, leaderboard metadata and the card) ----------

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Compact URL-safe code, e.g. "103426-a10-0-1-3k9x2p" */
export function encodeGenome(g: Genome): string {
  const parts = SLOTS.map((s) => g.parts[s].toString(36)).join('')
  const seed = (g.seed >>> 0).toString(36).padStart(7, '0')
  return `${parts}${g.hue.toString(36)}${g.pattern}${g.size}${g.shiny ? 1 : 0}${Math.min(g.mut, 9)}${seed}`
}

export function decodeGenome(code: string): Genome | null {
  if (typeof code !== 'string') return null
  const m = /^([0-7]{6})([0-9a-z])([0-9])([0-2])([01])([0-9])([0-9a-z]{7})$/.exec(code)
  if (!m) return null
  const parts = {} as Record<Slot, number>
  for (let i = 0; i < SLOTS.length; i++) {
    const idx = parseInt(m[1][i], 36)
    if (idx >= PARTS_BY_SLOT[SLOTS[i]].length) return null
    parts[SLOTS[i]] = idx
  }
  const hue = parseInt(m[2], 36)
  const pattern = parseInt(m[3], 10)
  if (hue >= PALETTE_COUNT || pattern >= PATTERN_COUNT) return null
  const seed = parseInt(m[7], 36)
  if (!Number.isFinite(seed) || seed > 0xffffffff) return null
  return {
    parts,
    hue,
    pattern,
    size: parseInt(m[4], 10) as 0 | 1 | 2,
    shiny: m[5] === '1',
    mut: parseInt(m[6], 10),
    seed,
  }
}

export function genomesEqual(a: Genome, b: Genome): boolean {
  return encodeGenome(a) === encodeGenome(b)
}

// ---------- generation ----------

export function makeGenome(
  partIds: Partial<Record<Slot, string>>,
  extra: Partial<Pick<Genome, 'hue' | 'pattern' | 'size' | 'shiny' | 'seed' | 'mut'>> = {},
): Genome {
  const parts = {} as Record<Slot, number>
  for (const s of SLOTS) {
    const id = partIds[s]
    const idx = id ? PARTS_BY_SLOT[s].findIndex((p) => p.id === id) : 0
    if (idx < 0) throw new Error(`Unknown part ${s}:${id}`)
    parts[s] = idx
  }
  return {
    parts,
    hue: extra.hue ?? 0,
    pattern: extra.pattern ?? 0,
    size: extra.size ?? 1,
    shiny: extra.shiny ?? false,
    seed: extra.seed ?? 1,
    mut: extra.mut ?? 0,
  }
}

/** Parts the player can currently roll for mutation; defaults to the starter set. */
export type PartPool = ReadonlySet<string>

export const starterPool = (): Set<string> => new Set(STARTER_PART_KEYS)

export function randomPartFromPool(slot: Slot, rng: Rng, pool: PartPool, exclude: number | number[] = []): number {
  const ex = Array.isArray(exclude) ? exclude : [exclude]
  const all = PARTS_BY_SLOT[slot].map((p, i) => ({ p, i }))
  const cands = all.filter(({ p, i }) => pool.has(partKey(p.slot, p.id)) && !ex.includes(i))
  const list = cands.length ? cands : all.filter(({ i }) => !ex.includes(i))
  return rng.weighted(list, (c) => RARITY_WEIGHT[c.p.rarity]).i
}

export function randomGenome(rng: Rng, pool: PartPool = starterPool()): Genome {
  const parts = {} as Record<Slot, number>
  for (const s of SLOTS) parts[s] = randomPartFromPool(s, rng, pool)
  return {
    parts,
    hue: rng.int(PALETTE_COUNT),
    pattern: rng.int(PATTERN_COUNT),
    size: rng.weighted<0 | 1 | 2>([0, 1, 2], (v) => (v === 1 ? 6 : 2)),
    shiny: false,
    seed: rng.seed(),
    mut: 0,
  }
}

export interface FuseOptions {
  /** per-slot mutation chance, default 0.12 */
  mutationChance?: number
  /** extra chance added by a Mutagen */
  boost?: number
  /** parts the player owns / has unlocked (mutations draw from these) */
  pool: PartPool
  /** chance a mutation reaches outside the pool and "discovers" a brand-new part */
  wildChance?: number
}

export interface FuseResult {
  genome: Genome
  /** slots that mutated */
  mutatedSlots: Slot[]
  /** slots that inherited from parent A / B (non-mutated) */
  fromA: Slot[]
  fromB: Slot[]
  /** part keys that came from outside the pool */
  wild: string[]
  paletteMutated: boolean
  shiny: boolean
}

export const BASE_MUTATION = 0.12
export const SHINY_CHANCE = 0.035

/** Fusion core: pure + seeded. Same parents + same rng stream => identical child. */
export function fuse(a: Genome, b: Genome, rng: Rng, opts: FuseOptions): FuseResult {
  const chance = Math.min(0.95, (opts.mutationChance ?? BASE_MUTATION) + (opts.boost ?? 0))
  const wildChance = opts.wildChance ?? 0.1
  const parts = {} as Record<Slot, number>
  const mutatedSlots: Slot[] = []
  const fromA: Slot[] = []
  const fromB: Slot[] = []
  const wild: string[] = []

  for (const s of SLOTS) {
    const pickA = rng.chance(0.5)
    const inherited = pickA ? a.parts[s] : b.parts[s]
    if (rng.chance(chance)) {
      const useWild = rng.chance(wildChance)
      const pool = useWild ? new Set(PARTS_BY_SLOT[s].map((p) => partKey(p.slot, p.id))) : opts.pool
      const idx = randomPartFromPool(s, rng, pool, [a.parts[s], b.parts[s]])
      // wild mutation only counts as wild if the part is really outside the player's pool
      const k = partKey(s, PARTS_BY_SLOT[s][idx].id)
      if (useWild && !opts.pool.has(k)) wild.push(k)
      parts[s] = idx
      mutatedSlots.push(s)
    } else {
      parts[s] = inherited
      ;(pickA ? fromA : fromB).push(s)
    }
  }

  // palette: inherit one parent, or blend to the neighbouring hue, or mutate
  let hue: number
  let paletteMutated = false
  const r = rng.next()
  if (r < 0.42) hue = a.hue
  else if (r < 0.84) hue = b.hue
  else if (r < 0.92) {
    hue = (Math.round((a.hue + b.hue) / 2) + (rng.chance(0.5) ? 1 : 0)) % PALETTE_COUNT
  } else {
    hue = rng.int(PALETTE_COUNT)
    paletteMutated = true
  }
  const pattern = rng.chance(0.5) ? a.pattern : rng.chance(0.5) ? b.pattern : rng.int(PATTERN_COUNT)

  // size: average with a nudge
  const avg = (a.size + b.size) / 2
  let size = Math.round(avg + (rng.chance(0.25) ? (rng.chance(0.5) ? 1 : -1) : 0)) as number
  size = Math.max(0, Math.min(2, size))

  const shiny = rng.chance(SHINY_CHANCE + (opts.boost ? 0.03 : 0)) || (a.shiny && b.shiny && rng.chance(0.4))

  const genome: Genome = {
    parts,
    hue,
    pattern,
    size: size as 0 | 1 | 2,
    shiny,
    seed: rng.seed(),
    mut: mutatedSlots.length + (paletteMutated ? 1 : 0),
  }
  return { genome, mutatedSlots, fromA, fromB, wild, paletteMutated, shiny }
}

export { PART_BY_KEY }
