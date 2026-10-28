import { PART_BY_KEY, PART_PRICE, PARTS, STARTER_PART_KEYS, partKey, type Slot } from './parts'
import { decodeGenome, partKeysOf, type Genome } from './genome'
import { frightOf, rarityRank, type Rarity } from './fright'
import { buildCreature, genomeOf, starterCreatures, type Creature, type FusionOutcome } from './creature'
import { dailyOrders, orderMet, type Order } from './orders'
import { emptyStreak, streakReward, tickStreak, type StreakState } from './daily'
import { POD_BY_ID } from './pods'
import { ALL_SPECIES } from './fright'
import { MYTHICS } from './recipes'

export interface Settings {
  music: boolean
  sfx: boolean
  haptics: boolean
  /** 'auto' follows the OS preference */
  motion: 'auto' | 'full' | 'reduced'
  fastFusion: boolean
  /** opt-in local reminder when the daily gift is ready */
  remind: boolean
}

export interface CodexSpecies {
  best: string // creature code
  name: string
  fright: number
  rarity: Rarity
  count: number
  first: string // day
}

export interface Codex {
  species: Record<string, CodexSpecies>
  parts: string[]
  mythics: string[]
  names: string[]
}

export interface Economy {
  coins: number
  mutagens: number
  capacity: number
  unlocked: string[]
  pods: string[]
  pod: string
  ads: { day: string; n: number }
  /** premium entitlements granted by the RUN shop (item ids) */
  entitled: string[]
}

export interface DailyState {
  day: string
  orders: Record<string, { done: boolean; by?: string }>
  fusions: number
  bestFright: number
  bestCode: string
  bestName: string
  giftClaimed: boolean
}

export interface Meta {
  tutorialDone: boolean
  created: number
  fusions: number
  playSeconds: number
  shares: number
  bestFright: number
  bestCode: string
  bestName: string
  lastSubmitted: { fright: number; collector: number }
  challengesWon: number
}

export interface RushMeta {
  day: string
  /** daily rush attempts used today */
  attempts: number
  /** extra attempts earned today (rewarded ads) */
  extra: number
  bestDaily: number
  bestAll: number
  bestAllCode: string
  bestAllName: string
  played: number
}
export const RUSH_FREE_ATTEMPTS = 2
export const emptyRush = (): RushMeta => ({ day: '', attempts: 0, extra: 0, bestDaily: 0, bestAll: 0, bestAllCode: '', bestAllName: '', played: 0 })
export const rushAttemptsLeft = (r: RushMeta, today: string) => (r.day === today ? RUSH_FREE_ATTEMPTS + r.extra - r.attempts : RUSH_FREE_ATTEMPTS)

export interface GameState {
  v: 1
  settings: Settings
  meta: Meta
  eco: Economy
  pen: Creature[]
  codex: Codex
  daily: DailyState
  streak: StreakState
  rush: RushMeta
}

export const PEN_BASE = 12
export const PEN_STEP = 4
export const PEN_MAX = 40
export const penPrice = (capacity: number) => 200 * Math.pow(2, Math.max(0, (capacity - PEN_BASE) / PEN_STEP))
export const MUTAGEN_PRICE = 220
export const MAX_ADS_PER_DAY = 5
export const RECYCLE_RATE = 0.12

export function defaultSettings(): Settings {
  return { music: true, sfx: true, haptics: true, motion: 'auto', fastFusion: false, remind: false }
}

export function newGame(now: number, day: string): GameState {
  const pen = starterCreatures(day)
  const codex: Codex = { species: {}, parts: [], mythics: [], names: pen.map((c) => c.name) }
  for (const c of pen) {
    registerInCodex(codex, c, day)
  }
  return {
    v: 1,
    settings: defaultSettings(),
    meta: {
      tutorialDone: false,
      created: now,
      fusions: 0,
      playSeconds: 0,
      shares: 0,
      bestFright: 0,
      bestCode: '',
      bestName: '',
      lastSubmitted: { fright: 0, collector: 0 },
      challengesWon: 0,
    },
    eco: { coins: 100, mutagens: 1, capacity: PEN_BASE, unlocked: [...STARTER_PART_KEYS], pods: ['classic'], pod: 'classic', ads: { day, n: 0 }, entitled: [] },
    pen,
    codex,
    daily: { day: '', orders: {}, fusions: 0, bestFright: 0, bestCode: '', bestName: '', giftClaimed: false },
    streak: emptyStreak(),
    rush: emptyRush(),
  }
}

// ---------- codex ----------

export interface CodexDelta {
  newSpecies: boolean
  newParts: string[]
  newMythic: boolean
  improvedBest: boolean
}

export function registerInCodex(codex: Codex, c: Creature, day: string): CodexDelta {
  const delta: CodexDelta = { newSpecies: false, newParts: [], newMythic: false, improvedBest: false }
  const g = genomeOf(c)
  for (const k of partKeysOf(g)) {
    if (!codex.parts.includes(k)) {
      codex.parts.push(k)
      delta.newParts.push(k)
    }
  }
  if (c.mythic) {
    if (!codex.mythics.includes(c.mythic)) {
      codex.mythics.push(c.mythic)
      delta.newMythic = true
    }
  } else {
    const cur = codex.species[c.species]
    if (!cur) {
      codex.species[c.species] = { best: c.code, name: c.name, fright: c.fright, rarity: c.rarity, count: 1, first: day }
      delta.newSpecies = true
    } else {
      cur.count++
      if (c.fright > cur.fright) {
        cur.best = c.code
        cur.name = c.name
        cur.fright = c.fright
        cur.rarity = c.rarity
        delta.improvedBest = true
      }
    }
  }
  if (!codex.names.includes(c.name)) codex.names.push(c.name)
  return delta
}

export const CODEX_TOTAL = ALL_SPECIES.length + MYTHICS.length + PARTS.length

export function codexCounts(codex: Codex) {
  const species = Object.keys(codex.species).length
  const mythics = codex.mythics.length
  const parts = codex.parts.length
  const found = species + mythics + parts
  return { species, mythics, parts, found, total: CODEX_TOTAL, pct: Math.floor((found / CODEX_TOTAL) * 100), exact: (found / CODEX_TOTAL) * 100 }
}

/** The "collector" leaderboard score. */
export function collectorScore(codex: Codex): number {
  return Object.keys(codex.species).length * 10 + codex.parts.length * 5 + codex.mythics.length * 60
}

// ---------- fusion application ----------

export interface FusionEvents {
  coins: number
  delta: CodexDelta
  newBest: boolean
  newDailyBest: boolean
  penFull: boolean
  newParts: string[]
  mythic: boolean
  unlockedWild: string[]
  rewardBreakdown: { label: string; coins: number }[]
}

export const fuseReward = (fright: number) => 8 + Math.round(fright / 25)

/** Applies a finished fusion to the state. Mutates a draft copy and returns it. */
export function applyFusion(state: GameState, outcome: FusionOutcome, today: string, usedMutagen: boolean): { state: GameState; ev: FusionEvents } {
  const s = structuredClone(state) as GameState
  const c = outcome.child
  const delta = registerInCodex(s.codex, c, today)
  const rewardBreakdown: { label: string; coins: number }[] = [{ label: 'Fusion', coins: fuseReward(c.fright) }]
  if (delta.newSpecies) rewardBreakdown.push({ label: 'New species', coins: 30 })
  if (delta.newParts.length) rewardBreakdown.push({ label: `${delta.newParts.length} new part${delta.newParts.length > 1 ? 's' : ''}`, coins: 40 * delta.newParts.length })
  if (delta.newMythic) rewardBreakdown.push({ label: 'Mythic discovery!', coins: 300 })
  const coins = rewardBreakdown.reduce((n, r) => n + r.coins, 0)
  s.eco.coins += coins

  // wild mutations unlock the part for the player
  const unlockedWild: string[] = []
  for (const k of outcome.result.wild) {
    if (!s.eco.unlocked.includes(k)) {
      s.eco.unlocked.push(k)
      unlockedWild.push(k)
    }
  }
  // any part that shows up on a creature we made can be used for mutation from now on
  for (const k of delta.newParts) if (!s.eco.unlocked.includes(k)) s.eco.unlocked.push(k)

  if (usedMutagen) s.eco.mutagens = Math.max(0, s.eco.mutagens - 1)

  const penFull = s.pen.length >= s.eco.capacity
  if (!penFull) s.pen.push(c)

  s.meta.fusions++
  const newBest = c.fright > s.meta.bestFright
  if (newBest) {
    s.meta.bestFright = c.fright
    s.meta.bestCode = c.code
    s.meta.bestName = c.name
  }
  s.daily.fusions++
  const newDailyBest = c.fright > s.daily.bestFright
  if (newDailyBest) {
    s.daily.bestFright = c.fright
    s.daily.bestCode = c.code
    s.daily.bestName = c.name
  }
  return {
    state: s,
    ev: { coins, delta, newBest, newDailyBest, penFull, newParts: delta.newParts, mythic: delta.newMythic || !!c.mythic, unlockedWild, rewardBreakdown },
  }
}

export function recycleValue(c: Creature): number {
  return Math.max(5, Math.round(c.fright * RECYCLE_RATE))
}

export function recycle(state: GameState, id: string): GameState {
  const s = structuredClone(state) as GameState
  const i = s.pen.findIndex((c) => c.id === id)
  if (i < 0) return state
  s.eco.coins += recycleValue(s.pen[i])
  s.pen.splice(i, 1)
  return s
}

/** child that arrived while the pen was full: swap one out (or recycle the newcomer). */
export function keepChild(state: GameState, child: Creature, swapOutId: string): GameState {
  const s = structuredClone(state) as GameState
  const i = s.pen.findIndex((c) => c.id === swapOutId)
  if (i < 0) return state
  s.eco.coins += recycleValue(s.pen[i])
  s.pen.splice(i, 1, child)
  return s
}
export function recycleChild(state: GameState, child: Creature): GameState {
  const s = structuredClone(state) as GameState
  s.eco.coins += recycleValue(child)
  return s
}

// ---------- shop ----------

export type BuyResult = { ok: true; state: GameState } | { ok: false; reason: string }

export function buyPart(state: GameState, key: string): BuyResult {
  const p = PART_BY_KEY[key]
  if (!p) return { ok: false, reason: 'Unknown part' }
  if (state.eco.unlocked.includes(key)) return { ok: false, reason: 'Already unlocked' }
  const price = PART_PRICE[p.rarity]
  if (state.eco.coins < price) return { ok: false, reason: 'Not enough coins' }
  const s = structuredClone(state) as GameState
  s.eco.coins -= price
  s.eco.unlocked.push(key)
  return { ok: true, state: s }
}

export function buyPodWithCoins(state: GameState, id: string): BuyResult {
  const pod = POD_BY_ID[id]
  if (!pod) return { ok: false, reason: 'Unknown pod' }
  if (state.eco.pods.includes(id)) return { ok: false, reason: 'Already owned' }
  if (state.eco.coins < pod.coins) return { ok: false, reason: 'Not enough coins' }
  const s = structuredClone(state) as GameState
  s.eco.coins -= pod.coins
  s.eco.pods.push(id)
  s.eco.pod = id
  return { ok: true, state: s }
}

export function grantPod(state: GameState, id: string): GameState {
  if (state.eco.pods.includes(id)) return state
  const s = structuredClone(state) as GameState
  s.eco.pods.push(id)
  if (!s.eco.entitled.includes('pod_' + id)) s.eco.entitled.push('pod_' + id)
  return s
}

export function equipPod(state: GameState, id: string): GameState {
  if (!state.eco.pods.includes(id)) return state
  return { ...state, eco: { ...state.eco, pod: id } }
}

export function buyMutagen(state: GameState): BuyResult {
  if (state.eco.coins < MUTAGEN_PRICE) return { ok: false, reason: 'Not enough coins' }
  const s = structuredClone(state) as GameState
  s.eco.coins -= MUTAGEN_PRICE
  s.eco.mutagens++
  return { ok: true, state: s }
}

export function buyCapacity(state: GameState): BuyResult {
  if (state.eco.capacity >= PEN_MAX) return { ok: false, reason: 'Pen is at max size' }
  const price = penPrice(state.eco.capacity)
  if (state.eco.coins < price) return { ok: false, reason: 'Not enough coins' }
  const s = structuredClone(state) as GameState
  s.eco.coins -= price
  s.eco.capacity += PEN_STEP
  return { ok: true, state: s }
}

export function adsLeft(state: GameState, today: string): number {
  return state.eco.ads.day === today ? Math.max(0, MAX_ADS_PER_DAY - state.eco.ads.n) : MAX_ADS_PER_DAY
}
export function grantAdMutagen(state: GameState, today: string): GameState {
  const s = structuredClone(state) as GameState
  if (s.eco.ads.day !== today) s.eco.ads = { day: today, n: 0 }
  if (s.rush.day !== today) s.rush = { ...s.rush, day: today, attempts: 0, extra: 0, bestDaily: 0 }
  s.eco.ads.n++
  s.eco.mutagens++
  return s
}

// ---------- daily ----------

export interface DayRoll {
  state: GameState
  streakKind: 'first' | 'continued' | 'same' | 'broken'
  /** a gift is waiting to be claimed */
  giftPending: boolean
}

/** Called when the app opens or the UTC day flips. */
export function rollDay(state: GameState, today: string): DayRoll {
  const s = structuredClone(state) as GameState
  const t = tickStreak(s.streak, today)
  s.streak = t.state
  if (s.daily.day !== today) {
    s.daily = { day: today, orders: {}, fusions: 0, bestFright: 0, bestCode: '', bestName: '', giftClaimed: false }
    for (const o of dailyOrders(today)) s.daily.orders[o.id] = { done: false }
  }
  if (s.eco.ads.day !== today) s.eco.ads = { day: today, n: 0 }
  if (s.rush.day !== today) s.rush = { ...s.rush, day: today, attempts: 0, extra: 0, bestDaily: 0 }
  const giftPending = s.streak.claimed !== today
  return { state: s, streakKind: t.kind, giftPending }
}

export function claimGift(state: GameState, today: string): { state: GameState; reward: ReturnType<typeof streakReward> } | null {
  if (state.streak.claimed === today) return null
  const s = structuredClone(state) as GameState
  const reward = streakReward(s.streak.streak)
  s.eco.coins += reward.coins
  s.eco.mutagens += reward.mutagens
  s.streak.claimed = today
  s.daily.giftClaimed = true
  return { state: s, reward }
}

export interface DeliverResult {
  state: GameState
  reward: number
  bonus: number
}

export function deliverOrder(state: GameState, order: Order, creatureId: string): DeliverResult | null {
  const st = state.daily.orders[order.id]
  if (!st || st.done) return null
  const idx = state.pen.findIndex((c) => c.id === creatureId)
  if (idx < 0) return null
  const c = state.pen[idx]
  if (!orderMet(order, c)) return null
  const s = structuredClone(state) as GameState
  const bonus = rarityRank(c.rarity) >= 2 ? Math.round(order.reward * 0.25) : 0
  s.eco.coins += order.reward + bonus
  s.daily.orders[order.id] = { done: true, by: c.name }
  s.pen.splice(idx, 1)
  return { state: s, reward: order.reward, bonus }
}

// ---------- persistence shape ----------

export const SAVE_KEYS = ['settings', 'meta', 'eco', 'pen', 'codex', 'daily', 'streak', 'rush'] as const

export function serialize(state: GameState): Record<(typeof SAVE_KEYS)[number], string> {
  return {
    settings: JSON.stringify(state.settings),
    meta: JSON.stringify(state.meta),
    eco: JSON.stringify(state.eco),
    pen: JSON.stringify(state.pen),
    codex: JSON.stringify(state.codex),
    daily: JSON.stringify(state.daily),
    streak: JSON.stringify(state.streak),
    rush: JSON.stringify(state.rush),
  }
}

export function deserialize(raw: Partial<Record<(typeof SAVE_KEYS)[number], string | null>>, now: number, today: string): GameState | null {
  if (!raw.pen || !raw.eco) return null
  try {
    const base = newGame(now, today)
    const parse = <T,>(k: (typeof SAVE_KEYS)[number], fallback: T): T => {
      const v = raw[k]
      if (!v) return fallback
      try {
        return { ...(fallback as object), ...(JSON.parse(v) as object) } as T
      } catch {
        return fallback
      }
    }
    const pen = (JSON.parse(raw.pen) as Creature[]).filter((c) => !!decodeGenome(c.code))
    const s: GameState = {
      v: 1,
      settings: parse('settings', base.settings),
      meta: parse('meta', base.meta),
      eco: parse('eco', base.eco),
      pen,
      codex: parse('codex', base.codex),
      daily: parse('daily', base.daily),
      streak: parse('streak', base.streak),
      rush: parse('rush', base.rush),
    }
    if (!s.eco.unlocked?.length) s.eco.unlocked = [...STARTER_PART_KEYS]
    return s
  } catch {
    return null
  }
}

export { frightOf, partKey, buildCreature }
export type { Slot, Genome }
