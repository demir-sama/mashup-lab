import { PARTS_BY_SLOT, SLOTS, THEMES, THEME_INFO, type Slot, type Theme } from './parts'
import { partOf, partsOf, type Genome } from './genome'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

export const RARITY_INFO: Record<Rarity, { label: string; color: string; glow: string; rank: number; stars: number }> = {
  common: { label: 'Common', color: '#b9b4c8', glow: '#d9d3ea', rank: 0, stars: 1 },
  uncommon: { label: 'Uncommon', color: '#7dff6b', glow: '#b6ff9f', rank: 1, stars: 2 },
  rare: { label: 'Rare', color: '#4cc9ff', glow: '#9fe3ff', rank: 2, stars: 3 },
  epic: { label: 'Epic', color: '#c26bff', glow: '#e0a8ff', rank: 3, stars: 4 },
  legendary: { label: 'Legendary', color: '#ffb52e', glow: '#ffe08a', rank: 4, stars: 5 },
  mythic: { label: 'Mythic', color: '#ff4f9a', glow: '#ff9fcb', rank: 5, stars: 6 },
}

/** Synergy: parts sharing one theme. 3 of a theme starts to pay, 6 is a perfect set. */
export const SYNERGY: readonly number[] = [0, 0, 0, 10, 24, 45, 80]
export const FRIGHT_SCALE = 2.5
export const SIZE_MULT = [0.9, 1, 1.15] as const
export const SHINY_MULT = 1.3
export const MYTHIC_MULT = 1.6
export const MUTATION_BONUS = 6

/** Rarity thresholds on the Fright score (mythic is decided by recipes, not score). */
export const RARITY_THRESHOLDS = { uncommon: 95, rare: 160, epic: 250, legendary: 370 } as const

export function themeCounts(g: Genome): Record<Theme, number> {
  const c = { fire: 0, ghost: 0, bug: 0, goo: 0, gothic: 0, sweet: 0 } as Record<Theme, number>
  for (const p of partsOf(g)) if (p.theme) c[p.theme]++
  return c
}

/** The theme that "names" the creature. Ties break by slot order (body first). */
export function dominantTheme(g: Genome): Theme {
  const c = themeCounts(g)
  let best: Theme | null = null
  let bestN = 0
  for (const t of THEMES) {
    if (c[t] > bestN) {
      bestN = c[t]
      best = t
    }
  }
  if (!best) return 'goo'
  // tie-break: first slot whose theme is among the tied leaders
  const leaders = THEMES.filter((t) => c[t] === bestN)
  if (leaders.length > 1) {
    for (const s of SLOTS) {
      const th = partOf(g, s).theme
      if (th && leaders.includes(th)) return th
    }
  }
  return best
}

export function maxThemeCount(g: Genome): number {
  return Math.max(...Object.values(themeCounts(g)))
}

export function synergyBonus(g: Genome): number {
  return SYNERGY[Math.min(6, maxThemeCount(g))] ?? 0
}

export function eyeCount(g: Genome): number {
  return partOf(g, 'eyes').eyeCount ?? 2
}

export interface FrightBreakdown {
  parts: number
  synergy: number
  mutation: number
  sizeMult: number
  shinyMult: number
  mythicMult: number
  jitter: number
  total: number
}

export function frightBreakdown(g: Genome, mythic = false): FrightBreakdown {
  const parts = partsOf(g).reduce((n, p) => n + p.fright, 0)
  const synergy = synergyBonus(g)
  const mutation = Math.min(g.mut, 6) * MUTATION_BONUS
  const sizeMult = SIZE_MULT[g.size]
  const shinyMult = g.shiny ? SHINY_MULT : 1
  const mythicMult = mythic ? MYTHIC_MULT : 1
  // deterministic cosmetic jitter of +-4% from the genome seed
  const jitter = 0.96 + ((g.seed >>> 3) % 1000) / 12500
  const raw = (parts + synergy + mutation) * sizeMult * shinyMult * mythicMult * jitter
  return { parts, synergy, mutation, sizeMult, shinyMult, mythicMult, jitter, total: Math.round(raw * FRIGHT_SCALE) }
}

export function frightOf(g: Genome, mythic = false): number {
  return frightBreakdown(g, mythic).total
}

export function rarityFromFright(fright: number, mythic = false): Rarity {
  if (mythic) return 'mythic'
  if (fright >= RARITY_THRESHOLDS.legendary) return 'legendary'
  if (fright >= RARITY_THRESHOLDS.epic) return 'epic'
  if (fright >= RARITY_THRESHOLDS.rare) return 'rare'
  if (fright >= RARITY_THRESHOLDS.uncommon) return 'uncommon'
  return 'common'
}

export function rarityRank(r: Rarity): number {
  return RARITY_INFO[r].rank
}

// ---------- species & epithets ----------

const BODY_NOUN: Record<string, string> = {
  blob: 'Blob',
  egg: 'Egg',
  gourd: 'Gourd',
  sheet: 'Bedsheet',
  puff: 'Fuzzball',
  tower: 'Coffin',
  jelly: 'Jelly',
  patch: 'Patchwork',
}

export function speciesKey(g: Genome): string {
  return `${partOf(g, 'body').id}:${dominantTheme(g)}`
}

export function speciesTitle(g: Genome): string {
  return `${THEME_INFO[dominantTheme(g)].adj} ${BODY_NOUN[partOf(g, 'body').id]}`
}

export const ALL_SPECIES: readonly { key: string; body: string; theme: Theme; title: string }[] = PARTS_BY_SLOT.body.flatMap((b) =>
  THEMES.map((t) => ({ key: `${b.id}:${t}`, body: b.id, theme: t, title: `${THEME_INFO[t].adj} ${BODY_NOUN[b.id]}` })),
)

export function slotLabel(s: Slot): string {
  return { body: 'Body', head: 'Head', eyes: 'Eyes', limbs: 'Limbs', tail: 'Tail', aura: 'Aura' }[s]
}
