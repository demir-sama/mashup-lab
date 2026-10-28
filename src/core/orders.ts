import { Rng } from './rng'
import { PARTS_BY_SLOT, THEMES, THEME_INFO, partKey, type Slot, type Theme } from './parts'
import { eyeCount, rarityRank, themeCounts, type Rarity, RARITY_INFO } from './fright'
import { makeGenome, randomGenome, partKeysOf, partsOf, starterPool, type Genome } from './genome'
import { genomeOf, type Creature } from './creature'
import { freshName } from './names'

export type Requirement =
  | { kind: 'eyes'; n: number }
  | { kind: 'tag'; tag: 'wings' | 'claws' | 'tentacles' | 'legs8' | 'tail' }
  | { kind: 'part'; key: string }
  | { kind: 'theme'; theme: Theme; min: number }
  | { kind: 'rarity'; min: Rarity }
  | { kind: 'fright'; min: number }
  | { kind: 'size'; size: 0 | 2 }
  | { kind: 'shiny' }

export interface Order {
  id: string
  day: string
  tier: 1 | 2 | 3
  client: { name: string; genome: Genome; line: string }
  reqs: Requirement[]
  reward: number
}

export function reqLabel(r: Requirement): string {
  switch (r.kind) {
    case 'eyes':
      return r.n === 1 ? '1 big eye' : `${r.n} eyes`
    case 'tag':
      return { wings: 'Wings', claws: 'Claws', tentacles: 'Tentacles', legs8: '8 legs', tail: 'A tail' }[r.tag]
    case 'part': {
      const [slot, id] = r.key.split(':')
      const p = PARTS_BY_SLOT[slot as Slot].find((x) => x.id === id)
      return p ? p.name : r.key
    }
    case 'theme':
      return `${r.min}+ ${THEME_INFO[r.theme].label} parts`
    case 'rarity':
      return `${RARITY_INFO[r.min].label}+`
    case 'fright':
      return `Fright ${r.min}+`
    case 'size':
      return r.size === 2 ? 'Big' : 'Small'
    case 'shiny':
      return 'Shiny'
  }
}

export function reqMet(r: Requirement, c: Creature): boolean {
  const g = genomeOf(c)
  switch (r.kind) {
    case 'eyes':
      return eyeCount(g) === r.n
    case 'tag':
      return partsOf(g).some((p) => p.tags.includes(r.tag))
    case 'part':
      return partKeysOf(g).includes(r.key)
    case 'theme':
      return themeCounts(g)[r.theme] >= r.min
    case 'rarity':
      return rarityRank(c.rarity) >= rarityRank(r.min)
    case 'fright':
      return c.fright >= r.min
    case 'size':
      return g.size === r.size
    case 'shiny':
      return g.shiny
  }
}

export function orderMet(o: Order, c: Creature): boolean {
  return o.reqs.every((r) => reqMet(r, c))
}

export function orderProgress(o: Order, c: Creature): number {
  return o.reqs.filter((r) => reqMet(r, c)).length
}

const LINES_EASY = [
  'Hi! I\'m redecorating my crypt. Need something spooky!',
  'Got a party tonight. Surprise me, but with specifics!',
  'My last monster ran away. I need a replacement.',
  'I\'m not picky. Okay, I\'m a little picky.',
]
const LINES_MED = [
  'Two requirements. Is that too much to ask?',
  'It\'s for a very important haunting.',
  'My cousin has one. Mine must be better.',
]
const LINES_HARD = [
  'VIP order. Make it unforgettable.',
  'I pay well and I never smile. Impress me.',
  'The moon is full. Only the finest will do.',
]

const EASY_POOL: Requirement[] = [
  { kind: 'eyes', n: 3 },
  { kind: 'eyes', n: 1 },
  { kind: 'eyes', n: 2 },
  { kind: 'tag', tag: 'wings' },
  { kind: 'tag', tag: 'claws' },
  { kind: 'tag', tag: 'tail' },
  { kind: 'part', key: partKey('aura', 'flames') },
  { kind: 'part', key: partKey('aura', 'sparkles') },
  { kind: 'part', key: partKey('head', 'horned') },
  { kind: 'part', key: partKey('body', 'egg') },
  { kind: 'part', key: partKey('body', 'blob') },
  { kind: 'part', key: partKey('body', 'gourd') },
  { kind: 'size', size: 2 },
  { kind: 'size', size: 0 },
]

/** Deterministic daily orders: everybody on Earth gets the same three on the same UTC day. */
export function dailyOrders(day: string): Order[] {
  const rng = new Rng('orders:' + day)
  const pool = starterPool()
  const mkClient = (tier: number, lines: string[]) => {
    const g = randomGenome(rng, pool)
    const syl = freshName(rng)
    return { name: syl.join('').replace(/^./, (c) => c.toUpperCase()), genome: g, line: rng.pick(lines), tier }
  }

  // tier 1: one easy requirement
  const r1 = rng.pick(EASY_POOL)
  const c1 = mkClient(1, LINES_EASY)

  // tier 2: two requirements from different kinds
  let r2a = rng.pick(EASY_POOL)
  let r2b = rng.pick(EASY_POOL)
  let guard = 0
  while ((r2b.kind === r2a.kind || JSON.stringify(r2b) === JSON.stringify(r1)) && guard++ < 30) r2b = rng.pick(EASY_POOL)
  if (JSON.stringify(r2a) === JSON.stringify(r1)) r2a = rng.pick(EASY_POOL.filter((r) => JSON.stringify(r) !== JSON.stringify(r1)))
  const c2 = mkClient(2, LINES_MED)

  // tier 3: VIP, a theme set, a rarity or a Fright bar (+ maybe an extra)
  const theme = rng.pick(THEMES)
  const kind = rng.int(3)
  const reqs3: Requirement[] =
    kind === 0
      ? [{ kind: 'theme', theme, min: 3 }]
      : kind === 1
        ? [{ kind: 'rarity', min: 'rare' }, rng.pick(EASY_POOL.filter((r) => r.kind === 'eyes' || r.kind === 'tag'))]
        : [{ kind: 'fright', min: 150 + rng.int(4) * 25 }]
  const c3 = mkClient(3, LINES_HARD)

  const mk = (tier: 1 | 2 | 3, reqs: Requirement[], c: ReturnType<typeof mkClient>, reward: number): Order => ({
    id: `${day}#${tier}`,
    day,
    tier,
    client: { name: c.name, genome: c.genome, line: c.line },
    reqs,
    reward,
  })
  return [mk(1, [r1], c1, 60), mk(2, [r2a, r2b], c2, 120), mk(3, reqs3, c3, 240)]
}

export function ordersFor(day: string) {
  return dailyOrders(day)
}

export { makeGenome }
