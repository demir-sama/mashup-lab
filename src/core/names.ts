import { Rng } from './rng'

const ONSETS = ['b', 'bl', 'br', 'd', 'dr', 'f', 'fl', 'g', 'gl', 'gr', 'gl', 'h', 'j', 'k', 'kr', 'm', 'n', 'p', 'pl', 'r', 's', 'sn', 'sk', 'sl', 'sm', 'sp', 'st', 't', 'tr', 'v', 'w', 'z', 'sh', 'ch', 'sq', 'sw', 'gh', 'zl']
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'oo', 'ee', 'ar', 'or', 'ib', 'ob', 'ug', 'ax', 'ack', 'ump', 'orp']
const CODAS = ['', '', '', 'b', 'g', 'm', 'n', 'p', 't', 'x', 'ck', 'rp', 'ng', 'll', 'zz', 'sh', 'mp', 'nk', 'bble', 'ggle', 'ndle']

export function freshSyllable(rng: Rng): string {
  const o = rng.pick(ONSETS)
  const v = rng.pick(VOWELS)
  const c = rng.chance(0.55) ? rng.pick(CODAS) : ''
  // avoid awkward doubled letters like "oooo" or "bbb"
  return (o + v + c).slice(0, 6)
}

export function freshName(rng: Rng): string[] {
  const n = rng.chance(0.65) ? 2 : 3
  return Array.from({ length: n }, () => freshSyllable(rng))
}

export function displayName(syl: readonly string[]): string {
  const s = syl.join('').replace(/(.)\1\1+/g, '$1$1')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Child names are spliced from the parents' syllables: the front of one + the back of the other.
 * Mutated children swap in a brand new syllable. Result is always 2-3 syllables, <= 12 letters.
 */
export function childSyllables(a: readonly string[], b: readonly string[], rng: Rng, mutated: boolean): string[] {
  const front = rng.chance(0.5)
  const first = front ? a : b
  const second = front ? b : a
  const takeFront = Math.min(first.length, 1 + (first.length > 2 && rng.chance(0.4) ? 1 : 0))
  const takeBack = Math.min(second.length, 1 + (second.length > 2 && rng.chance(0.4) ? 1 : 0))
  let syl = [...first.slice(0, takeFront), ...second.slice(Math.max(0, second.length - takeBack))]
  if (mutated) {
    const at = rng.int(syl.length)
    syl[at] = freshSyllable(rng)
  }
  if (syl.length > 3) syl = [syl[0], syl[1], syl[syl.length - 1]]
  if (syl.length < 2) syl = [...syl, freshSyllable(rng)]
  // too long? shorten
  while (displayName(syl).length > 12 && syl.length > 2) syl = [syl[0], syl[syl.length - 1]]
  if (displayName(syl).length > 12) syl = [syl[0].slice(0, 4), syl[1].slice(0, 5)]
  return syl
}

export function uniqueSyllables(
  make: () => string[],
  taken: ReadonlySet<string>,
  rng: Rng,
): string[] {
  for (let i = 0; i < 8; i++) {
    const s = make()
    if (!taken.has(displayName(s))) return s
  }
  // fall back to a brand-new name, then a numeral
  for (let i = 0; i < 8; i++) {
    const s = freshName(rng)
    if (!taken.has(displayName(s))) return s
  }
  const s = freshName(rng)
  s[s.length - 1] += 'ii'
  return s
}
