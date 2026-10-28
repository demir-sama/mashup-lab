import { makeGenome, type Genome } from './genome'
import { partKey } from './parts'

/**
 * Hidden mythic recipes. If one parent carries partA and the other carries partB (either way
 * round), the fusion is guaranteed to produce the mythic creature - no luck involved. Players
 * only get a riddle; the codex page stays a silhouette until they crack it.
 */
export interface MythicRecipe {
  id: string
  name: string
  syl: string[]
  title: string
  /** part keys (slot:id) - one on each parent */
  a: string
  b: string
  tier: 1 | 2 | 3
  hint: string
  lore: string
  genome: Genome
}

const M = (
  id: string,
  syl: string[],
  title: string,
  a: string,
  b: string,
  tier: 1 | 2 | 3,
  hint: string,
  lore: string,
  genome: Genome,
): MythicRecipe => ({ id, name: syl.join('').replace(/^./, (c) => c.toUpperCase()), syl, title, a, b, tier, hint, lore, genome })

export const MYTHICS: readonly MythicRecipe[] = [
  M(
    'wobblegulp',
    ['wob', 'ble', 'gulp'],
    'Baron of the Bog',
    partKey('head', 'horned'),
    partKey('eyes', 'cyclops'),
    1,
    'A horned brow meets a single, enormous stare. Bring them together.',
    'He swallowed a lake, burped, and was crowned.',
    makeGenome({ body: 'jelly', head: 'horned', eyes: 'cyclops', limbs: 'tentacles', tail: 'lizard', aura: 'drips' }, { hue: 4, pattern: 1, size: 2, seed: 7101 }),
  ),
  M(
    'pumpkinpyre',
    ['pump', 'kin', 'pyre'],
    'The Last Harvest',
    partKey('body', 'gourd'),
    partKey('aura', 'sparkles'),
    1,
    'Something round and orange wants to be wished upon.',
    'Every October it rolls out of the field and sets the scarecrows on fire. Politely.',
    makeGenome({ body: 'gourd', head: 'horned', eyes: 'slit', limbs: 'claws', tail: 'flame', aura: 'flames' }, { hue: 2, pattern: 3, size: 2, seed: 7102 }),
  ),
  M(
    'glitterbat',
    ['glit', 'ter', 'bat'],
    'Baroness of Sparkle',
    partKey('limbs', 'bat'),
    partKey('tail', 'spade'),
    1,
    'Wings of the night, a tail with a point. Add glamour.',
    'Her cape is 40% glitter and 60% menace.',
    makeGenome({ body: 'tower', head: 'dome', eyes: 'sleepy', limbs: 'bat', tail: 'spade', aura: 'sparkles' }, { hue: 10, pattern: 2, size: 1, seed: 7103, shiny: true }),
  ),
  M(
    'archdimples',
    ['arch', 'dim', 'ples'],
    'Archduke of Smiles',
    partKey('head', 'dome'),
    partKey('eyes', 'trio'),
    1,
    'A friendly dome and a bonus eye. Two worlds, one smile.',
    'Nobody has ever seen him frown. Nobody has asked him to stop smiling.',
    makeGenome({ body: 'egg', head: 'dome', eyes: 'trio', limbs: 'noodle', tail: 'fluff', aura: 'sparkles' }, { hue: 3, pattern: 1, size: 2, seed: 7104 }),
  ),
  M(
    'hollowbone',
    ['hol', 'low', 'bone'],
    'Lady of the Hollow Hall',
    partKey('body', 'sheet'),
    partKey('head', 'skull'),
    2,
    'A drifting sheet and a grinning dome. Only the hollow shall rise.',
    'She hosts a very exclusive haunting every full moon. RSVP with screams.',
    makeGenome({ body: 'sheet', head: 'skull', eyes: 'quad', limbs: 'moth', tail: 'fish', aura: 'mist' }, { hue: 11, pattern: 0, size: 2, seed: 7105 }),
  ),
  M(
    'longlegs',
    ['moth', 'er', 'legz'],
    'Matron of Many Legs',
    partKey('body', 'tower'),
    partKey('limbs', 'spider'),
    2,
    'Something tall and creaky borrows eight spindly legs.',
    'Knits scarves for monsters with exactly nine necks.',
    makeGenome({ body: 'tower', head: 'bulb', eyes: 'swarm', limbs: 'spider', tail: 'scorpion', aura: 'moons' }, { hue: 9, pattern: 2, size: 2, seed: 7106 }),
  ),
  M(
    'wyrmwag',
    ['wyrm', 'wag', 'gle'],
    'The Wagging Wyrm',
    partKey('tail', 'lizard'),
    partKey('tail', 'flame'),
    3,
    'Two very different tails, one burning with spirit. Wag them together.',
    'The only dragon who is a very good boy.',
    makeGenome({ body: 'patch', head: 'horned', eyes: 'slit', limbs: 'claws', tail: 'flame', aura: 'flames' }, { hue: 6, pattern: 3, size: 2, seed: 7107, shiny: true }),
  ),
  M(
    'voltquill',
    ['volt', 'quill', 'ex'],
    'Storm Court Jester',
    partKey('aura', 'volt'),
    partKey('eyes', 'stalks'),
    3,
    'Crackling air meets curious stalks. Handle with rubber gloves.',
    'Tells shocking jokes. The audience is always charged.',
    makeGenome({ body: 'puff', head: 'bulb', eyes: 'stalks', limbs: 'pincers', tail: 'scorpion', aura: 'volt' }, { hue: 8, pattern: 1, size: 1, seed: 7108, shiny: true }),
  ),
]

export const MYTHIC_BY_ID: Readonly<Record<string, MythicRecipe>> = Object.fromEntries(MYTHICS.map((m) => [m.id, m]))

/** Returns the mythic a pairing triggers, if any. Order of parents does not matter. */
export function matchRecipe(partsA: readonly string[], partsB: readonly string[]): MythicRecipe | null {
  for (const m of MYTHICS) {
    if ((partsA.includes(m.a) && partsB.includes(m.b)) || (partsA.includes(m.b) && partsB.includes(m.a))) return m
  }
  return null
}
