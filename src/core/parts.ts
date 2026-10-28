// The part catalog: 48 hand-built parts over 6 slots. Rendering lives in src/art; this file is
// pure data so the game rules (fusion, fright, orders, codex) can be unit tested without a canvas.

export type Slot = 'body' | 'head' | 'eyes' | 'limbs' | 'tail' | 'aura'
export const SLOTS: readonly Slot[] = ['body', 'head', 'eyes', 'limbs', 'tail', 'aura']

export type Theme = 'fire' | 'ghost' | 'bug' | 'goo' | 'gothic' | 'sweet'
export const THEMES: readonly Theme[] = ['fire', 'ghost', 'bug', 'goo', 'gothic', 'sweet']

export const THEME_INFO: Record<Theme, { label: string; adj: string; color: string }> = {
  fire: { label: 'Fiery', adj: 'Fiery', color: '#ff7a1a' },
  ghost: { label: 'Ghostly', adj: 'Ghastly', color: '#9fe7ff' },
  bug: { label: 'Buggy', adj: 'Creepy-Crawly', color: '#c6ff3d' },
  goo: { label: 'Gooey', adj: 'Gooey', color: '#43e8a6' },
  gothic: { label: 'Gothic', adj: 'Gothic', color: '#c46bff' },
  sweet: { label: 'Sugary', adj: 'Sugary', color: '#ff7fc0' },
}

export type Rarity1to4 = 1 | 2 | 3 | 4

export interface PartDef {
  id: string
  slot: Slot
  name: string
  blurb: string
  rarity: Rarity1to4
  /** base fright contribution */
  fright: number
  theme: Theme | null
  tags: string[]
  /** unlocked from the start */
  starter?: boolean
  /** for eyes: how many eyes the part draws */
  eyeCount?: number
}

const P = (
  slot: Slot,
  id: string,
  name: string,
  blurb: string,
  rarity: Rarity1to4,
  fright: number,
  theme: Theme | null,
  extra: Partial<PartDef> = {},
): PartDef => ({ id, slot, name, blurb, rarity, fright, theme, tags: [], ...extra })

export const PARTS: readonly PartDef[] = [
  // ---- BODY ----
  P('body', 'blob', 'Blobbo', 'Lumpy, wobbly and proud of it.', 1, 4, 'goo', { starter: true }),
  P('body', 'egg', 'Eggsy', 'Smooth shell. Suspiciously sturdy.', 1, 3, 'sweet', { starter: true }),
  P('body', 'gourd', 'Gourdy', 'Carved from a very angry pumpkin.', 1, 5, 'fire', { starter: true }),
  P('body', 'sheet', 'Bedsheet', 'Floats. Does not own legs.', 2, 9, 'ghost'),
  P('body', 'puff', 'Fuzzball', 'Soft fur, many opinions.', 2, 7, 'bug'),
  P('body', 'tower', 'Coffin Tall', 'Narrow, dignified, slightly creaky.', 2, 10, 'gothic'),
  P('body', 'jelly', 'Jelly Cube', 'See-through. Wobbles in 3D.', 3, 14, 'goo'),
  P('body', 'patch', 'Patchwork', 'Stitched together from leftovers.', 4, 22, 'gothic'),
  // ---- HEAD ----
  P('head', 'bare', 'Faceplant', 'No head. The face sits on the body.', 1, 1, null, { starter: true }),
  P('head', 'dome', 'Round Head', 'Friendly dome with tiny ears.', 1, 3, 'sweet', { starter: true }),
  P('head', 'horned', 'Horny Head', 'Curly horns, short temper.', 1, 8, 'fire', { starter: true }),
  P('head', 'shroom', 'Mushcap', 'A spotted cap that glows at night.', 2, 6, 'goo'),
  P('head', 'cone', 'Party Cone', 'Pointy hat. Celebrating something.', 2, 5, 'sweet'),
  P('head', 'bulb', 'Big Brain', 'Huge skull, tiny antennae.', 2, 8, 'bug'),
  P('head', 'square', 'Bolt Block', 'Flat top. Bolted on, mostly.', 3, 13, 'gothic'),
  P('head', 'skull', 'Skullcap', 'Grinning bone dome.', 3, 15, 'ghost'),
  // ---- EYES ----
  P('eyes', 'pair', 'Two Eyes', 'The classic.', 1, 2, null, { starter: true, eyeCount: 2 }),
  P('eyes', 'cyclops', 'One Big Eye', 'Why have two when one is enough?', 1, 6, 'goo', { starter: true, eyeCount: 1 }),
  P('eyes', 'trio', 'Three Eyes', 'A bonus eye in the middle.', 1, 8, 'ghost', { starter: true, eyeCount: 3 }),
  P('eyes', 'sleepy', 'Sleepy Eyes', 'Half-closed, fully judging.', 2, 4, 'sweet', { eyeCount: 2 }),
  P('eyes', 'slit', 'Slit Eyes', 'Dragon stare.', 2, 9, 'fire', { eyeCount: 2 }),
  P('eyes', 'stalks', 'Eye Stalks', 'Eyes on springs. Very nosy.', 2, 8, 'bug', { eyeCount: 2 }),
  P('eyes', 'quad', 'Four Eyes', 'Two pairs, zero blind spots.', 3, 13, 'gothic', { eyeCount: 4 }),
  P('eyes', 'swarm', 'Eye Swarm', 'Six eyes that never agree.', 4, 20, 'bug', { eyeCount: 6 }),
  // ---- LIMBS ----
  P('limbs', 'stubs', 'Stubby Limbs', 'Little feet, little arms.', 1, 2, null, { starter: true }),
  P('limbs', 'claws', 'Big Claws', 'Hooked claws for hugging.', 1, 7, 'gothic', { starter: true, tags: ['claws'] }),
  P('limbs', 'bat', 'Bat Wings', 'Leathery wings. Cape optional.', 1, 9, 'gothic', { starter: true, tags: ['wings'] }),
  P('limbs', 'tentacles', 'Tentacles', 'Six wiggly reasons to run.', 2, 10, 'goo', { tags: ['tentacles'] }),
  P('limbs', 'spider', 'Spider Legs', 'Eight spindly legs.', 2, 11, 'bug', { tags: ['legs8'] }),
  P('limbs', 'noodle', 'Noodle Arms', 'Impossibly long, impossibly floppy.', 2, 5, 'sweet'),
  P('limbs', 'moth', 'Moth Wings', 'Dusty, patterned wings.', 3, 14, 'ghost', { tags: ['wings'] }),
  P('limbs', 'pincers', 'Crab Pincers', 'Snip snip.', 3, 12, 'fire', { tags: ['claws'] }),
  // ---- TAIL ----
  P('tail', 'none', 'No Tail', 'Tailless and carefree.', 1, 0, null, { starter: true }),
  P('tail', 'lizard', 'Lizard Tail', 'Long and curvy.', 1, 4, 'goo', { starter: true, tags: ['tail'] }),
  P('tail', 'spade', 'Spade Tail', 'Devilishly pointy.', 1, 7, 'fire', { starter: true, tags: ['tail'] }),
  P('tail', 'fluff', 'Fluffy Tail', 'A cloud on a stick.', 2, 4, 'sweet', { tags: ['tail'] }),
  P('tail', 'fish', 'Fishtail', 'Splashy. Surprisingly graceful.', 2, 6, 'ghost', { tags: ['tail'] }),
  P('tail', 'scorpion', 'Stinger Tail', 'Curled up and ready.', 2, 10, 'bug', { tags: ['tail'] }),
  P('tail', 'flame', 'Flame Tail', 'Hot. Please do not pet.', 3, 13, 'fire', { tags: ['tail'] }),
  P('tail', 'lantern', 'Lantern Tail', 'A glowing lure in the dark.', 3, 12, 'gothic', { tags: ['tail'] }),
  // ---- AURA ----
  P('aura', 'none', 'No Aura', 'Just vibes.', 1, 0, null, { starter: true }),
  P('aura', 'sparkles', 'Sparkles', 'Glitter follows everywhere.', 1, 3, 'sweet', { starter: true }),
  P('aura', 'flames', 'Ring of Fire', 'Dramatic backdrop included.', 1, 8, 'fire', { starter: true }),
  P('aura', 'mist', 'Spooky Mist', 'Cold fog and distant sighs.', 2, 9, 'ghost'),
  P('aura', 'drips', 'Slime Drips', 'Dripping, glistening, delighted.', 2, 7, 'goo'),
  P('aura', 'moons', 'Moons & Stars', 'Tiny orbiting night sky.', 3, 12, 'gothic'),
  P('aura', 'volt', 'Static Volt', 'Crackling little lightning.', 3, 13, 'bug'),
  P('aura', 'bats', 'Bat Swarm', 'A flapping escort of bats.', 4, 18, 'gothic'),
]

// ids are unique per slot, not globally ("none" is used by tail and aura) so key by slot:id.
export const partKey = (slot: Slot, id: string) => `${slot}:${id}`
export const PART_BY_KEY: Readonly<Record<string, PartDef>> = Object.fromEntries(PARTS.map((p) => [partKey(p.slot, p.id), p]))

export const PARTS_BY_SLOT: Readonly<Record<Slot, readonly PartDef[]>> = {
  body: PARTS.filter((p) => p.slot === 'body'),
  head: PARTS.filter((p) => p.slot === 'head'),
  eyes: PARTS.filter((p) => p.slot === 'eyes'),
  limbs: PARTS.filter((p) => p.slot === 'limbs'),
  tail: PARTS.filter((p) => p.slot === 'tail'),
  aura: PARTS.filter((p) => p.slot === 'aura'),
}

export const STARTER_PART_KEYS: readonly string[] = PARTS.filter((p) => p.starter).map((p) => partKey(p.slot, p.id))

export const RARITY_WEIGHT: Record<Rarity1to4, number> = { 1: 1, 2: 0.55, 3: 0.28, 4: 0.12 }
export const PART_PRICE: Record<Rarity1to4, number> = { 1: 80, 2: 220, 3: 520, 4: 1100 }

export function partAt(slot: Slot, index: number): PartDef {
  return PARTS_BY_SLOT[slot][index]
}
export function partIndex(slot: Slot, id: string): number {
  return PARTS_BY_SLOT[slot].findIndex((p) => p.id === id)
}
