import { drawCreature } from '../src/art/creature'
import { makeGenome } from '../src/core/genome'
import { PARTS_BY_SLOT, SLOTS, type Slot } from '../src/core/parts'
import { starterCreatures, genomeOf } from '../src/core/creature'

const q = new URLSearchParams(location.search)
const slot = (q.get('slot') ?? 'body') as Slot | 'starters' | 'mood'
const t = Number(q.get('t') ?? 1.3)
const cv = document.getElementById('c') as HTMLCanvasElement
const cols = 4
const W = 1600
const cell = W / cols
const base: Record<Slot, string> = { body: 'blob', head: 'dome', eyes: 'pair', limbs: 'stubs', tail: 'lizard', aura: 'none' }

const items = [] as ReturnType<typeof makeGenome>[]
if (slot === 'starters') {
  for (const c of starterCreatures('x')) items.push(genomeOf(c))
} else if (slot === 'mood') {
  for (let i = 0; i < 8; i++) items.push(makeGenome({ ...base, body: 'egg', head: 'horned', eyes: 'trio' }, { hue: i, pattern: i % 4, seed: 3 + i, size: (i % 3) as 0 | 1 | 2, shiny: i === 7 }))
} else {
  for (const p of PARTS_BY_SLOT[slot]) {
    const parts = { ...base, [slot]: p.id }
    items.push(makeGenome(parts, { hue: items.length % 12, pattern: items.length % 4, seed: 5 + items.length }))
  }
}
const rows = Math.ceil(items.length / cols)
const cellH = 480
cv.width = W
cv.height = rows * cellH
cv.style.width = W + 'px'
const ctx = cv.getContext('2d')!
ctx.fillStyle = '#2a1252'
ctx.fillRect(0, 0, cv.width, cv.height)
items.forEach((g, i) => {
  const x = (i % cols) * cell + cell / 2
  const y = Math.floor(i / cols) * cellH + 420
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1.15, 1.15)
  const mood = slot === 'mood' ? (['idle', 'happy', 'scared', 'dizzy', 'sleepy', 'shout', 'idle', 'happy'] as const)[i] : 'idle'
  drawCreature(ctx, g, { t, mood })
  ctx.restore()
  ctx.fillStyle = '#fff'
  ctx.font = '16px sans-serif'
  const label = slot === 'starters' || slot === 'mood' ? String(i) : PARTS_BY_SLOT[slot][i].id
  ctx.fillText(label, x - cell / 2 + 10, Math.floor(i / cols) * cellH + 20)
})
;(window as any).__done = true
void SLOTS
