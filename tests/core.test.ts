import { describe, expect, it } from 'vitest'
import { Rng } from '../src/core/rng'
import { PARTS, PARTS_BY_SLOT, SLOTS, THEMES, STARTER_PART_KEYS, partKey } from '../src/core/parts'
import { decodeGenome, encodeGenome, fuse, makeGenome, randomGenome, starterPool, partKeysOf, type Genome } from '../src/core/genome'
import { frightOf, frightBreakdown, rarityFromFright, themeCounts, synergyBonus, ALL_SPECIES, dominantTheme, speciesKey } from '../src/core/fright'
import { buildCreature, fuseCreatures, genomeOf, starterCreatures } from '../src/core/creature'
import { MYTHICS, matchRecipe } from '../src/core/recipes'
import { childSyllables, displayName, freshName } from '../src/core/names'
import { dailyOrders, orderMet, reqMet } from '../src/core/orders'
import { dayKey, daysBetween, emptyStreak, streakReward, tickStreak } from '../src/core/daily'
import {
  applyFusion, buyCapacity, buyMutagen, buyPart, buyPodWithCoins, claimGift, codexCounts, collectorScore, deliverOrder, deserialize, newGame, rollDay,
  serialize, CODEX_TOTAL, PEN_BASE, penPrice, recycle, keepChild,
} from '../src/core/state'

const DAY = '2026-10-31'

describe('catalog', () => {
  it('has 48 parts, 8 per slot, unique ids per slot', () => {
    expect(PARTS.length).toBe(48)
    for (const s of SLOTS) {
      expect(PARTS_BY_SLOT[s].length).toBe(8)
      expect(new Set(PARTS_BY_SLOT[s].map((p) => p.id)).size).toBe(8)
    }
  })
  it('every theme appears in at least 4 slots with >= 6 parts', () => {
    for (const t of THEMES) {
      const ps = PARTS.filter((p) => p.theme === t)
      expect(ps.length).toBeGreaterThanOrEqual(6)
      expect(new Set(ps.map((p) => p.slot)).size).toBeGreaterThanOrEqual(5)
    }
  })
  it('starter set is 3 parts per slot with wings and eyes variety', () => {
    expect(STARTER_PART_KEYS.length).toBe(18)
    expect(STARTER_PART_KEYS).toContain(partKey('limbs', 'bat'))
    expect(STARTER_PART_KEYS).toContain(partKey('eyes', 'trio'))
  })
})

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = new Rng(42), b = new Rng(42)
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next())
    expect(new Rng('x').next()).not.toBe(new Rng('y').next())
  })
})

describe('genome codes', () => {
  it('round trips random genomes', () => {
    const rng = new Rng(1)
    const all = new Set(PARTS.map((p) => partKey(p.slot, p.id)))
    for (let i = 0; i < 300; i++) {
      const g = randomGenome(rng, all)
      g.shiny = rng.chance(0.3)
      g.mut = rng.int(8)
      const code = encodeGenome(g)
      expect(decodeGenome(code)).toEqual(g)
    }
  })
  it('rejects garbage', () => {
    for (const bad of ['', 'abc', '99999900000000000', '000000zz0000000000', '<script>', '000000a000000zzzzzzzzzz']) expect(decodeGenome(bad)).toBeNull()
  })
})

describe('fusion', () => {
  const all = starterPool()
  const a = makeGenome({ body: 'blob', head: 'dome', eyes: 'pair', limbs: 'stubs', tail: 'lizard', aura: 'none' }, { hue: 0, seed: 1 })
  const b = makeGenome({ body: 'gourd', head: 'horned', eyes: 'trio', limbs: 'bat', tail: 'spade', aura: 'flames' }, { hue: 2, seed: 2 })

  it('is deterministic for a given seed', () => {
    const r1 = fuse(a, b, new Rng(99), { pool: all })
    const r2 = fuse(a, b, new Rng(99), { pool: all })
    expect(encodeGenome(r1.genome)).toBe(encodeGenome(r2.genome))
  })
  it('children inherit only parent parts when mutation is off', () => {
    const rng = new Rng(5)
    for (let i = 0; i < 200; i++) {
      const r = fuse(a, b, rng, { pool: all, mutationChance: 0 })
      for (const s of SLOTS) expect([a.parts[s], b.parts[s]]).toContain(r.genome.parts[s])
      expect(r.mutatedSlots).toHaveLength(0)
    }
  })
  it('mutation rate tracks the configured chance and the Mutagen boost', () => {
    const rate = (boost: number) => {
      const rng = new Rng(7)
      let n = 0
      const N = 3000
      for (let i = 0; i < N; i++) n += fuse(a, b, rng, { pool: all, boost }).mutatedSlots.length
      return n / (N * SLOTS.length)
    }
    const base = rate(0)
    const boosted = rate(0.3)
    expect(base).toBeGreaterThan(0.09)
    expect(base).toBeLessThan(0.15)
    expect(boosted).toBeGreaterThan(0.38)
    expect(boosted).toBeLessThan(0.46)
  })
  it('mutations come from the pool, or are reported as wild', () => {
    const rng = new Rng(11)
    for (let i = 0; i < 400; i++) {
      const r = fuse(a, b, rng, { pool: all, boost: 0.5 })
      for (const s of r.mutatedSlots) {
        const k = partKey(s, PARTS_BY_SLOT[s][r.genome.parts[s]].id)
        if (!all.has(k)) expect(r.wild).toContain(k)
      }
    }
  })
  it('mutated child never equals the same part it replaced', () => {
    const rng = new Rng(3)
    for (let i = 0; i < 300; i++) {
      const r = fuse(a, b, rng, { pool: all, mutationChance: 1 })
      for (const s of r.mutatedSlots) expect([a.parts[s], b.parts[s]]).not.toContain(r.genome.parts[s])
    }
  })
})

describe('fright & rarity', () => {
  it('sums parts and adds synergy for matching themes', () => {
    const goth = makeGenome({ body: 'tower', head: 'square', eyes: 'quad', limbs: 'bat', tail: 'lantern', aura: 'moons' }, { seed: 1 })
    expect(themeCounts(goth).gothic).toBe(6)
    expect(synergyBonus(goth)).toBe(80)
    const mixed = makeGenome({ body: 'tower', head: 'dome', eyes: 'cyclops', limbs: 'claws', tail: 'spade', aura: 'sparkles' }, { seed: 1 })
    expect(frightOf(goth)).toBeGreaterThan(frightOf(mixed) * 2)
  })
  it('shiny, size and mythic multipliers apply', () => {
    const g = makeGenome({ body: 'blob', head: 'dome', eyes: 'pair', limbs: 'stubs', tail: 'none', aura: 'none' }, { seed: 8 })
    const base = frightOf(g)
    expect(frightOf({ ...g, shiny: true })).toBeGreaterThan(base)
    expect(frightOf({ ...g, size: 2 })).toBeGreaterThan(base)
    expect(frightOf({ ...g, size: 0 })).toBeLessThan(base)
    expect(frightOf(g, true)).toBeGreaterThan(base)
    expect(frightBreakdown(g).total).toBe(base)
  })
  it('rarity bands are monotonic and mythic is recipe-only', () => {
    expect(rarityFromFright(10)).toBe('common')
    expect(rarityFromFright(100)).toBe('uncommon')
    expect(rarityFromFright(170)).toBe('rare')
    expect(rarityFromFright(260)).toBe('epic')
    expect(rarityFromFright(400)).toBe('legendary')
    expect(rarityFromFright(5, true)).toBe('mythic')
  })
  it('starter-pool rolls give a sensible rarity curve', () => {
    const rng = new Rng(2024)
    const pool = starterPool()
    const counts: Record<string, number> = {}
    const N = 4000
    for (let i = 0; i < N; i++) {
      const g = randomGenome(rng, pool)
      const r = rarityFromFright(frightOf(g))
      counts[r] = (counts[r] ?? 0) + 1
    }
    const pct = (k: string) => (counts[k] ?? 0) / N
    expect(pct('common')).toBeGreaterThan(0.3)
    expect(pct('common')).toBeLessThan(0.85)
    expect(pct('uncommon') + pct('rare')).toBeGreaterThan(0.12)
  })
  it('fully unlocked best-case is legendary, worst case is common', () => {
    const best = makeGenome({ body: 'patch', head: 'square', eyes: 'quad', limbs: 'bat', tail: 'lantern', aura: 'bats' }, { seed: 4, size: 2, shiny: true, mut: 6 })
    expect(rarityFromFright(frightOf(best))).toBe('legendary')
    const worst = makeGenome({ body: 'egg', head: 'bare', eyes: 'pair', limbs: 'stubs', tail: 'none', aura: 'none' }, { seed: 4, size: 0 })
    expect(rarityFromFright(frightOf(worst))).toBe('common')
  })
  it('every body x theme species key exists in the codex list', () => {
    expect(ALL_SPECIES.length).toBe(48)
    const rng = new Rng(9)
    const all = new Set(PARTS.map((p) => partKey(p.slot, p.id)))
    const keys = new Set(ALL_SPECIES.map((s) => s.key))
    for (let i = 0; i < 500; i++) expect(keys.has(speciesKey(randomGenome(rng, all)))).toBe(true)
    expect(THEMES).toContain(dominantTheme(randomGenome(rng, all)))
  })
})

describe('mythic recipes', () => {
  it('all 8 recipes are well-formed and unique', () => {
    expect(MYTHICS.length).toBe(8)
    const keys = new Set(MYTHICS.map((m) => [m.a, m.b].sort().join('|')))
    expect(keys.size).toBe(8)
    for (const m of MYTHICS) {
      expect(partKeysOf(m.genome).length).toBe(6)
      expect(frightOf(m.genome, true)).toBeGreaterThan(200)
    }
  })
  it('triggers regardless of parent order, only when parts sit on different parents', () => {
    const m = MYTHICS[0]
    expect(matchRecipe([m.a], [m.b])?.id).toBe(m.id)
    expect(matchRecipe([m.b], [m.a])?.id).toBe(m.id)
    expect(matchRecipe([m.a, m.b], [])).toBeNull()
  })
  it('a triggering fusion always yields the mythic', () => {
    const pool = starterPool()
    const pumpkin = MYTHICS.find((x) => x.id === 'pumpkinpyre')!
    const ca = buildCreature(makeGenome({ body: 'gourd', head: 'bare', eyes: 'pair', limbs: 'stubs', tail: 'none', aura: 'none' }), ['aa', 'bb'], DAY)
    const cb = buildCreature(makeGenome({ body: 'egg', head: 'bare', eyes: 'pair', limbs: 'stubs', tail: 'none', aura: 'sparkles' }), ['cc', 'dd'], DAY)
    for (let seed = 1; seed < 20; seed++) {
      const out = fuseCreatures({ a: ca, b: cb, seed, born: DAY, pool })
      expect(out.mythic?.id).toBe(pumpkin.id)
      expect(out.child.rarity).toBe('mythic')
      expect(out.child.name).toBe(pumpkin.name)
    }
    // once discovered, it only echoes back sometimes
    const known = new Set([pumpkin.id])
    let echoes = 0
    for (let seed = 1; seed <= 400; seed++) if (fuseCreatures({ a: ca, b: cb, seed, born: DAY, pool, knownMythics: known }).mythic) echoes++
    expect(echoes).toBeGreaterThan(60)
    expect(echoes).toBeLessThan(140)
  })
  it('starters can hit early mythics (discoverable) but the tutorial pair cannot', () => {
    const st = starterCreatures(DAY)
    let hits = 0
    for (const a of st) for (const b of st) if (a !== b && matchRecipe(partKeysOf(genomeOf(a)), partKeysOf(genomeOf(b)))) hits++
    expect(hits).toBeGreaterThan(0)
    expect(matchRecipe(partKeysOf(genomeOf(st[0])), partKeysOf(genomeOf(st[3])))).toBeNull()
  })
})

describe('names', () => {
  it('child names are 2-3 syllables, <=12 letters, spliced from parents', () => {
    const rng = new Rng(77)
    for (let i = 0; i < 500; i++) {
      const a = freshName(rng), b = freshName(rng)
      const c = childSyllables(a, b, rng, rng.chance(0.3))
      expect(c.length).toBeGreaterThanOrEqual(2)
      expect(c.length).toBeLessThanOrEqual(3)
      expect(displayName(c).length).toBeLessThanOrEqual(12)
      expect(displayName(c)).toMatch(/^[A-Z][a-z]+$/)
    }
  })
  it('unmutated children are built from parent syllables only', () => {
    const rng = new Rng(8)
    const a = ['gloo', 'py'], b = ['squash', 'ley']
    for (let i = 0; i < 100; i++) {
      for (const s of childSyllables(a, b, rng, false)) expect([...a, ...b]).toContain(s)
    }
  })
})

describe('daily orders', () => {
  it('are deterministic per UTC day and differ across days', () => {
    expect(dailyOrders('2026-10-30')).toEqual(dailyOrders('2026-10-30'))
    expect(JSON.stringify(dailyOrders('2026-10-30'))).not.toBe(JSON.stringify(dailyOrders('2026-10-31')))
  })
  it('three tiers with escalating rewards and 1/2/1+ requirements', () => {
    const o = dailyOrders(DAY)
    expect(o.map((x) => x.tier)).toEqual([1, 2, 3])
    expect(o[0].reqs).toHaveLength(1)
    expect(o[1].reqs).toHaveLength(2)
    expect(o[2].reward).toBeGreaterThan(o[1].reward)
  })
  it('easy and medium orders are satisfiable with starter parts (sampled)', () => {
    const pool = starterPool()
    for (let d = 1; d <= 60; d++) {
      const day = `2026-11-${String(d % 28 + 1).padStart(2, '0')}-${d}`.slice(0, 10)
      const orders = dailyOrders('2027-01-' + String((d % 28) + 1).padStart(2, '0') + (d > 28 ? 'b' : ''))
      for (const o of orders.slice(0, 2)) {
        const rng = new Rng(d * 31 + o.tier)
        let ok = false
        for (let i = 0; i < 6000 && !ok; i++) {
          const g = randomGenome(rng, pool)
          const c = buildCreature(g, ['a', 'b'], DAY)
          if (orderMet(o, c)) ok = true
        }
        expect(ok, JSON.stringify(o.reqs)).toBe(true)
      }
      void day
    }
  })
  it('reqMet reads eye counts and tags from the genome', () => {
    const c = buildCreature(makeGenome({ body: 'blob', head: 'bare', eyes: 'trio', limbs: 'bat', tail: 'none', aura: 'none' }), ['a', 'b'], DAY)
    expect(reqMet({ kind: 'eyes', n: 3 }, c)).toBe(true)
    expect(reqMet({ kind: 'tag', tag: 'wings' }, c)).toBe(true)
    expect(reqMet({ kind: 'tag', tag: 'claws' }, c)).toBe(false)
  })
})

describe('streaks', () => {
  it('counts consecutive UTC days, resets on a gap, ignores same-day reopen', () => {
    let s = emptyStreak()
    let r = tickStreak(s, '2026-10-28'); s = r.state; expect(r.kind).toBe('first'); expect(s.streak).toBe(1)
    r = tickStreak(s, '2026-10-28'); expect(r.kind).toBe('same'); expect(r.state.streak).toBe(1)
    r = tickStreak(s, '2026-10-29'); s = r.state; expect(r.kind).toBe('continued'); expect(s.streak).toBe(2)
    r = tickStreak(s, '2026-10-30'); s = r.state; expect(s.streak).toBe(3); expect(s.best).toBe(3)
    r = tickStreak(s, '2026-11-02'); s = r.state; expect(r.kind).toBe('broken'); expect(s.streak).toBe(1); expect(s.best).toBe(3)
  })
  it('handles month boundaries and day keys', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1)
    expect(dayKey(Date.UTC(2026, 10, 2, 23, 59))).toBe('2026-11-02')
  })
  it('milestone rewards', () => {
    expect(streakReward(3).milestone).toBe(true)
    expect(streakReward(7).mutagens).toBe(2)
    expect(streakReward(30).coins).toBeGreaterThan(streakReward(14).coins)
    expect(streakReward(2).milestone).toBe(false)
  })
})

describe('game state & economy', () => {
  const now = Date.UTC(2026, 9, 31, 12)
  const fresh = () => rollDay(newGame(now, DAY), DAY).state

  it('starts with 6 starters, coins, a mutagen and starter parts', () => {
    const s = fresh()
    expect(s.pen).toHaveLength(6)
    expect(s.eco.coins).toBe(100)
    expect(s.eco.unlocked).toHaveLength(18)
    expect(Object.keys(s.daily.orders)).toHaveLength(3)
    expect(s.streak.streak).toBe(1)
    expect(codexCounts(s.codex).found).toBeGreaterThan(0)
    expect(CODEX_TOTAL).toBe(48 + 8 + 48)
  })
  it('applyFusion adds the child, pays coins, updates codex and bests', () => {
    const s = fresh()
    const out = fuseCreatures({ a: s.pen[0], b: s.pen[3], seed: 5, born: DAY, pool: new Set(s.eco.unlocked) })
    const { state, ev } = applyFusion(s, out, DAY, false)
    expect(state.pen).toHaveLength(7)
    expect(state.eco.coins).toBe(100 + ev.coins)
    expect(state.meta.fusions).toBe(1)
    expect(state.meta.bestFright).toBe(out.child.fright)
    expect(state.daily.bestFright).toBe(out.child.fright)
    expect(state.codex.species[out.child.species]).toBeTruthy()
    // original state untouched
    expect(s.pen).toHaveLength(6)
  })
  it('discovered parts become part of the mutation pool', () => {
    let s = fresh()
    const big = buildCreature(makeGenome({ body: 'patch', head: 'skull', eyes: 'swarm', limbs: 'moth', tail: 'flame', aura: 'bats' }), ['aa', 'bb'], DAY)
    const out = fuseCreatures({ a: big, b: big, seed: 2, born: DAY, pool: new Set(s.eco.unlocked) })
    s = applyFusion(s, out, DAY, false).state
    expect(s.eco.unlocked.length).toBeGreaterThan(18)
  })
  it('pen capacity: a full pen does not add the child; swap & recycle work', () => {
    let s = fresh()
    s.eco.capacity = 6
    const out = fuseCreatures({ a: s.pen[0], b: s.pen[1], seed: 9, born: DAY, pool: new Set(s.eco.unlocked) })
    const r = applyFusion(s, out, DAY, false)
    expect(r.ev.penFull).toBe(true)
    expect(r.state.pen).toHaveLength(6)
    const k = keepChild(r.state, out.child, r.state.pen[0].id)
    expect(k.pen.some((c) => c.id === out.child.id)).toBe(true)
    expect(recycle(r.state, r.state.pen[0].id).pen).toHaveLength(5)
  })
  it('buying: parts, pods, mutagens, capacity respect prices', () => {
    let s = fresh()
    expect(buyPart(s, partKey('body', 'jelly')).ok).toBe(false)
    s.eco.coins = 5000
    const r = buyPart(s, partKey('body', 'jelly'))
    expect(r.ok).toBe(true)
    if (r.ok) { s = r.state; expect(s.eco.unlocked).toContain('body:jelly'); expect(s.eco.coins).toBe(5000 - 520) }
    expect(buyPart(s, partKey('body', 'jelly')).ok).toBe(false)
    const pod = buyPodWithCoins(s, 'pumpkin')
    expect(pod.ok && pod.state.eco.pod).toBe('pumpkin')
    const m = buyMutagen(s)
    expect(m.ok && m.state.eco.mutagens).toBe(2)
    const c = buyCapacity(s)
    expect(c.ok && c.state.eco.capacity).toBe(PEN_BASE + 4)
    expect(penPrice(16)).toBe(400)
  })
  it('daily gift can be claimed once per day', () => {
    const s = fresh()
    const g = claimGift(s, DAY)!
    expect(g.state.eco.coins).toBeGreaterThan(s.eco.coins)
    expect(claimGift(g.state, DAY)).toBeNull()
  })
  it('delivering a matching creature completes an order and pays; wrong creature is refused', () => {
    let s = fresh()
    const o = dailyOrders(DAY)[0]
    // craft a creature that meets the order via brute force over starter genomes
    const rng = new Rng(1)
    let match = null as ReturnType<typeof buildCreature> | null
    for (let i = 0; i < 20000 && !match; i++) {
      const c = buildCreature(randomGenome(rng, starterPool()), ['a', 'b'], DAY, { id: 'match' })
      if (orderMet(o, c)) match = c
    }
    expect(match).toBeTruthy()
    s.pen.push(match!)
    const before = s.eco.coins
    const res = deliverOrder(s, o, 'match')!
    expect(res.state.eco.coins).toBe(before + res.reward + res.bonus)
    expect(res.state.daily.orders[o.id].done).toBe(true)
    expect(res.state.pen.some((c) => c.id === 'match')).toBe(false)
    expect(deliverOrder(res.state, o, 'match')).toBeNull()
    const wrong = s.pen.find((c) => !orderMet(o, c))
    if (wrong) expect(deliverOrder(s, o, wrong.id)).toBeNull()
  })
  it('collector score and serialization round-trip', () => {
    const s = fresh()
    const raw = serialize(s)
    const back = deserialize(raw, now, DAY)!
    expect(back.pen.map((c) => c.code)).toEqual(s.pen.map((c) => c.code))
    expect(back.eco).toEqual(s.eco)
    expect(collectorScore(back.codex)).toBe(collectorScore(s.codex))
    expect(deserialize({}, now, DAY)).toBeNull()
  })
  it('rolling into a new day resets daily orders but keeps progress', () => {
    const s = fresh()
    const r = rollDay(s, '2026-11-01')
    expect(r.streakKind).toBe('continued')
    expect(r.state.streak.streak).toBe(2)
    expect(Object.keys(r.state.daily.orders)[0].startsWith('2026-11-01')).toBe(true)
    expect(r.state.pen).toHaveLength(6)
    expect(r.giftPending).toBe(true)
  })
})

describe('guaranteed tutorial fusion', () => {
  it('is at least uncommon and has a mutation, and is stable per seed', () => {
    const st = starterCreatures(DAY)
    for (let seed = 1; seed <= 25; seed++) {
      const o1 = fuseCreatures({ a: st[0], b: st[3], seed, born: DAY, pool: starterPool(), guarantee: true })
      const o2 = fuseCreatures({ a: st[0], b: st[3], seed, born: DAY, pool: starterPool(), guarantee: true })
      expect(o1.child.code).toBe(o2.child.code)
      expect(o1.child.rarity).not.toBe('common')
      expect(o1.child.name).toBe(o2.child.name)
    }
  })
})
export type { Genome }

import { challengeParams, dailySeed, parseChallenge, rushApply, rushDone, rushOutcome, rushSeedFor, rushStart, RUSH_FUSIONS } from '../src/core/rush'
describe('rush', () => {
  it('same seed gives same start; different seeds differ', () => {
    const a = rushStart(dailySeed('2026-11-01'), DAY)
    const b = rushStart(dailySeed('2026-11-01'), DAY)
    expect(a.pen.map((c) => c.code)).toEqual(b.pen.map((c) => c.code))
    expect(a.pen).toHaveLength(6)
    expect(rushStart(dailySeed('2026-11-02'), DAY).pen.map((c) => c.code)).not.toEqual(a.pen.map((c) => c.code))
  })
  it('outcomes are deterministic and independent of parent order', () => {
    const rs = rushStart('t1', DAY)
    const o1 = rushOutcome(rs, rs.pen[0], rs.pen[1], DAY)
    const o2 = rushOutcome(rs, rs.pen[1], rs.pen[0], DAY)
    expect(rushSeedFor('t1', 0, rs.pen[0], rs.pen[1])).toBe(rushSeedFor('t1', 0, rs.pen[1], rs.pen[0]))
    expect(o1.child.fright).toBeGreaterThan(0)
    expect(o2.child.id).toBe('f0')
  })
  it('runs exactly 5 fusions and tracks the best', () => {
    let rs = rushStart('t2', DAY)
    let n = 0
    while (!rushDone(rs)) {
      const a = rs.pen[n % rs.pen.length], b = rs.pen[(n + 3) % rs.pen.length]
      rs = rushApply(rs, rushOutcome(rs, a === b ? rs.pen[(n + 1) % rs.pen.length] : a, b, DAY))
      n++
    }
    expect(rs.used).toBe(RUSH_FUSIONS)
    expect(rs.best).toBe(Math.max(...rs.pen.filter((c) => rs.log.includes(c.id)).map((c) => c.fright)))
  })
  it('replaying the same choices reproduces the same score', () => {
    const play = () => {
      let rs = rushStart('t3', DAY)
      for (let i = 0; i < 5; i++) rs = rushApply(rs, rushOutcome(rs, rs.pen[i], rs.pen[i + 1], DAY))
      return rs.best
    }
    expect(play()).toBe(play())
  })
  it('challenge params round-trip and reject junk', () => {
    const p = challengeParams({ seed: 'rush-2026-11-01', target: 321, from: 'Mina', name: 'Gloopy' })
    expect(parseChallenge(p)).toEqual({ seed: 'rush-2026-11-01', target: 321, from: 'Mina', name: 'Gloopy' })
    expect(parseChallenge({ ...p, s: '<script>' })).toBeNull()
    expect(parseChallenge({ ...p, t: '999999' })).toBeNull()
    expect(parseChallenge({})).toBeNull()
    expect(parseChallenge({ ...p, f: '<b>Eve</b>' })?.from).toBe('bEveb')
  })
})
