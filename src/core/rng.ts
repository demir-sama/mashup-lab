// Small, fast, seedable PRNG utilities. Everything random in the game flows through Rng so that
// fusions, daily orders and challenge links are reproducible from a seed.

export function hashString(str: string): number {
  // xmur3-style hash -> 32 bit unsigned
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}

export class Rng {
  private s: number
  constructor(seed: number | string) {
    this.s = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9
  }
  /** mulberry32 -> float in [0,1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }
  chance(p: number): boolean {
    return this.next() < p
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)]
  }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    let total = 0
    for (const it of items) total += Math.max(0, weight(it))
    if (total <= 0) return items[this.int(items.length)]
    let r = this.next() * total
    for (const it of items) {
      r -= Math.max(0, weight(it))
      if (r <= 0) return it
    }
    return items[items.length - 1]
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  /** a fresh 32-bit seed derived from this stream */
  seed(): number {
    return Math.floor(this.next() * 4294967296) >>> 0
  }
}

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return a[0]
  }
  return Math.floor(Math.random() * 4294967296) >>> 0
}
