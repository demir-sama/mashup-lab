import { Rng, hashString } from './rng'
import { PARTS, partKey } from './parts'
import { randomGenome } from './genome'
import { buildCreature, fuseCreatures, type Creature, type FusionOutcome } from './creature'
import { freshName } from './names'

/** Rush: everybody gets the same 6 monsters per seed and 5 fusions. Highest Fright wins. */
export const RUSH_FUSIONS = 5
export const RUSH_START = 6
export const RUSH_BOOST = 0.12

const ALL_PARTS: ReadonlySet<string> = new Set(PARTS.map((p) => partKey(p.slot, p.id)))

export interface RushState {
  seed: string
  pen: Creature[]
  used: number
  best: number
  bestId: string
  /** ids of the fusion results in order */
  log: string[]
}

export function dailySeed(day: string): string {
  return 'rush-' + day
}

export function rushStart(seed: string, born: string): RushState {
  const rng = new Rng('start:' + seed)
  const pen: Creature[] = []
  for (let i = 0; i < RUSH_START; i++) {
    const g = randomGenome(rng, ALL_PARTS)
    pen.push(buildCreature(g, freshName(rng), born, { id: `r${i}` }))
  }
  return { seed, pen, used: 0, best: 0, bestId: '', log: [] }
}

export function rushSeedFor(seed: string, index: number, a: Creature, b: Creature): number {
  return hashString(`${seed}|${index}|${[a.code, b.code].sort().join('+')}`)
}

export function rushOutcome(rs: RushState, a: Creature, b: Creature, born: string): FusionOutcome {
  const out = fuseCreatures({
    a,
    b,
    seed: rushSeedFor(rs.seed, rs.used, a, b),
    born,
    pool: ALL_PARTS,
    boost: RUSH_BOOST,
    takenNames: new Set(rs.pen.map((c) => c.name)),
  })
  out.child.id = `f${rs.used}`
  return out
}

export function rushApply(rs: RushState, out: FusionOutcome): RushState {
  const c = out.child
  const better = c.fright > rs.best
  return {
    ...rs,
    pen: [...rs.pen, c],
    used: rs.used + 1,
    best: better ? c.fright : rs.best,
    bestId: better ? c.id : rs.bestId,
    log: [...rs.log, c.id],
  }
}

export const rushDone = (rs: RushState) => rs.used >= RUSH_FUSIONS

// ---------- challenge links ----------

export interface Challenge {
  seed: string
  target: number
  from: string
  name: string
}

export function challengeParams(c: Challenge): Record<string, string> {
  return { c: '1', s: c.seed, t: String(Math.round(c.target)), f: c.from.slice(0, 18), n: c.name.slice(0, 18) }
}

const SEED_RE = /^[a-z0-9:_-]{1,40}$/i

export function parseChallenge(p: Record<string, string> | undefined | null): Challenge | null {
  if (!p || p.c !== '1') return null
  const seed = String(p.s ?? '')
  if (!SEED_RE.test(seed)) return null
  const target = Number(p.t)
  if (!Number.isFinite(target) || target < 0 || target > 5000) return null
  const clean = (v: unknown) => String(v ?? '').replace(/[^\p{L}\p{N} _.'-]/gu, '').slice(0, 18)
  return { seed, target: Math.round(target), from: clean(p.f) || 'A rival', name: clean(p.n) || 'Mystery Monster' }
}

export function randomChallengeSeed(): string {
  return 'c-' + Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0')
}
