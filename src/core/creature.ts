import { Rng } from './rng'
import { decodeGenome, encodeGenome, fuse, makeGenome, partKeysOf, type FuseOptions, type FuseResult, type Genome } from './genome'
import { frightOf, rarityFromFright, speciesKey, speciesTitle, type Rarity } from './fright'
import { childSyllables, displayName, uniqueSyllables } from './names'
import { MYTHIC_BY_ID, matchRecipe, type MythicRecipe } from './recipes'

/** A creature in the player's pen. Fully derivable from `code` + `syl` + `mythic`. */
export interface Creature {
  id: string
  code: string
  name: string
  syl: string[]
  fright: number
  rarity: Rarity
  species: string
  title: string
  mythic?: string
  /** UTC day it was born, yyyy-mm-dd */
  born: string
  gen: number
  parents?: [string, string]
}

export const MYTHIC_ECHO = 0.25
let idCounter = 0
export function newId(rng?: Rng): string {
  idCounter++
  const r = rng ? rng.seed() : Math.floor(Math.random() * 4294967296)
  return `${Date.now().toString(36)}${idCounter.toString(36)}${r.toString(36).slice(0, 4)}`
}

export function genomeOf(c: Pick<Creature, 'code'>): Genome {
  const g = decodeGenome(c.code)
  if (!g) throw new Error('Bad genome code ' + c.code)
  return g
}

export function buildCreature(
  genome: Genome,
  syl: string[],
  born: string,
  opts: { mythic?: string; gen?: number; parents?: [string, string]; id?: string } = {},
): Creature {
  const mythic = !!opts.mythic
  const fright = frightOf(genome, mythic)
  return {
    id: opts.id ?? newId(),
    code: encodeGenome(genome),
    name: displayName(syl),
    syl,
    fright,
    rarity: rarityFromFright(fright, mythic),
    species: speciesKey(genome),
    title: mythic && opts.mythic ? MYTHIC_BY_ID[opts.mythic].title : speciesTitle(genome),
    mythic: opts.mythic,
    born,
    gen: opts.gen ?? 0,
    parents: opts.parents,
  }
}

export interface FusionOutcome {
  child: Creature
  result: FuseResult
  mythic: MythicRecipe | null
}

export interface FusionInput {
  a: Creature
  b: Creature
  seed: number
  born: string
  pool: ReadonlySet<string>
  boost?: boolean | number
  /** names already in the pen/codex, so we do not hand out duplicates */
  takenNames?: ReadonlySet<string>
  /** mythics the player has already discovered: they only echo back now and then */
  knownMythics?: ReadonlySet<string>
  /** tutorial: force a nice result (>= uncommon, at least one mutation) */
  guarantee?: boolean
}

/** Orchestrates a whole fusion: genome, mythic override, naming, fright. Pure & seeded. */
export function fuseCreatures(inp: FusionInput): FusionOutcome {
  const rng = new Rng(inp.seed)
  const ga = genomeOf(inp.a)
  const gb = genomeOf(inp.b)
  const opts: FuseOptions = { pool: inp.pool, boost: typeof inp.boost === 'number' ? inp.boost : inp.boost ? 0.3 : 0 }

  let result = fuse(ga, gb, rng, opts)
  if (inp.guarantee) {
    // re-roll up to a few times until the tutorial result is exciting (still seeded/deterministic)
    for (let i = 0; i < 40; i++) {
      const c = buildCreature(result.genome, ['x', 'y'], inp.born)
      if (c.rarity !== 'common' && result.genome.mut > 0) break
      result = fuse(ga, gb, rng, { ...opts, mutationChance: 0.5 })
    }
  }

  let recipe = matchRecipe(partKeysOf(ga), partKeysOf(gb))
  // first discovery is guaranteed; afterwards the mythic only echoes back 1 time in 4
  if (recipe && inp.knownMythics?.has(recipe.id) && !rng.chance(MYTHIC_ECHO)) recipe = null
  const taken = inp.takenNames ?? new Set<string>()
  const gen = Math.max(inp.a.gen, inp.b.gen) + 1
  const parents: [string, string] = [inp.a.name, inp.b.name]

  if (recipe) {
    const genome = { ...recipe.genome, parts: { ...recipe.genome.parts } }
    const child = buildCreature(genome, recipe.syl, inp.born, { mythic: recipe.id, gen, parents })
    return { child, result: { ...result, genome, mutatedSlots: [], wild: [] }, mythic: recipe }
  }

  const mutated = result.genome.mut > 0
  const syl = uniqueSyllables(() => childSyllables(inp.a.syl, inp.b.syl, rng, mutated), taken, rng)
  const child = buildCreature(result.genome, syl, inp.born, { gen, parents })
  return { child, result, mythic: null }
}

// ---------- starters ----------

interface StarterDef {
  syl: string[]
  g: Parameters<typeof makeGenome>
}

const STARTERS: StarterDef[] = [
  { syl: ['gloo', 'py'], g: [{ body: 'blob', head: 'bare', eyes: 'pair', limbs: 'stubs', tail: 'lizard', aura: 'none' }, { hue: 0, pattern: 1, seed: 11 }] },
  { syl: ['egg', 'bert'], g: [{ body: 'egg', head: 'dome', eyes: 'cyclops', limbs: 'stubs', tail: 'none', aura: 'sparkles' }, { hue: 5, pattern: 3, seed: 12 }] },
  { syl: ['squash', 'ley'], g: [{ body: 'gourd', head: 'horned', eyes: 'pair', limbs: 'claws', tail: 'spade', aura: 'none' }, { hue: 2, pattern: 2, seed: 13 }] },
  { syl: ['bo', 'zzle'], g: [{ body: 'blob', head: 'dome', eyes: 'trio', limbs: 'bat', tail: 'none', aura: 'flames' }, { hue: 10, pattern: 0, seed: 14 }] },
  { syl: ['nib', 'bick'], g: [{ body: 'egg', head: 'bare', eyes: 'trio', limbs: 'claws', tail: 'lizard', aura: 'sparkles' }, { hue: 3, pattern: 1, seed: 15 }] },
  { syl: ['grum', 'blin'], g: [{ body: 'gourd', head: 'bare', eyes: 'cyclops', limbs: 'bat', tail: 'spade', aura: 'flames' }, { hue: 1, pattern: 3, seed: 16 }] },
]

export function starterCreatures(born: string): Creature[] {
  return STARTERS.map((s, i) => buildCreature(makeGenome(...s.g), s.syl, born, { id: `starter-${i}` }))
}
