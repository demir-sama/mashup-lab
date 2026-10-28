/** Day keys are always UTC so every player (and the leaderboard reset) agrees on "today". */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function dayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

export function daysBetween(a: string, b: string): number {
  return dayIndex(b) - dayIndex(a)
}

export function msUntilNextDay(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - ms
}

export interface StreakState {
  streak: number
  best: number
  /** last day (yyyy-mm-dd) the player showed up */
  last: string
  /** last day the daily gift was claimed */
  claimed: string
}

export const emptyStreak = (): StreakState => ({ streak: 0, best: 0, last: '', claimed: '' })

/** Called when the app opens. Returns the new state and what changed. */
export function tickStreak(s: StreakState, today: string): { state: StreakState; kind: 'first' | 'continued' | 'same' | 'broken' } {
  if (!s.last) return { state: { ...s, streak: 1, best: Math.max(1, s.best), last: today }, kind: 'first' }
  const gap = daysBetween(s.last, today)
  if (gap <= 0) return { state: s, kind: 'same' }
  if (gap === 1) {
    const streak = s.streak + 1
    return { state: { ...s, streak, best: Math.max(s.best, streak), last: today }, kind: 'continued' }
  }
  return { state: { ...s, streak: 1, best: Math.max(s.best, 1), last: today }, kind: 'broken' }
}

export interface StreakReward {
  coins: number
  mutagens: number
  label: string
  milestone: boolean
}

export function streakReward(streak: number): StreakReward {
  const coins = 40 + 10 * Math.min(streak, 10)
  if (streak > 0 && streak % 30 === 0) return { coins: coins + 600, mutagens: 3, label: 'Monthly Mayhem chest', milestone: true }
  if (streak === 14) return { coins: coins + 300, mutagens: 2, label: 'Fortnight Fright chest', milestone: true }
  if (streak === 7) return { coins: coins + 200, mutagens: 2, label: 'Week of Weirdness chest', milestone: true }
  if (streak === 3) return { coins: coins + 80, mutagens: 1, label: 'Triple Treat', milestone: true }
  return { coins, mutagens: streak % 3 === 0 ? 1 : 0, label: 'Daily gift', milestone: false }
}
