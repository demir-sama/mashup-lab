// Renders the 1024x1024 key art used for public/thumbnail.jpg (downscaled to 512 by scripts/make-thumb.mjs).
import '@fontsource/lilita-one/400.css'
import { drawCreature } from '../src/art/creature'
import { makeGenome } from '../src/core/genome'

const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
async function main() {
  await document.fonts.load('140px "Lilita One"')
  const W = 1024
  let g = ctx.createRadialGradient(512, 560, 40, 512, 560, 760)
  g.addColorStop(0, '#6a2fc0'); g.addColorStop(0.55, '#3a1580'); g.addColorStop(1, '#150830')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, W)
  // goo glow
  g = ctx.createRadialGradient(512, 640, 10, 512, 640, 420)
  g.addColorStop(0, 'rgba(120,255,60,.55)'); g.addColorStop(1, 'rgba(120,255,60,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, W)
  // rays
  ctx.save(); ctx.translate(512, 640); ctx.globalAlpha = 0.12; ctx.fillStyle = '#c8ff6a'
  for (let i = 0; i < 14; i++) { ctx.rotate((Math.PI * 2) / 14); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -700); ctx.lineTo(40, -700); ctx.closePath(); ctx.fill() }
  ctx.restore()
  // moon
  ctx.fillStyle = '#e9ffb0'; ctx.beginPath(); ctx.arc(870, 330, 80, 0, 7); ctx.fill()
  ctx.fillStyle = 'rgba(120,160,40,.35)'; for (const [x, y, r] of [[845, 305, 20], [890, 360, 14], [880, 295, 9]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill() }
  const A = makeGenome({ body: 'sheet', head: 'bare', eyes: 'cyclops', limbs: 'stubs', tail: 'none', aura: 'mist' }, { hue: 8, pattern: 1, seed: 4, size: 1, shiny: false })
  const B = makeGenome({ body: 'gourd', head: 'horned', eyes: 'trio', limbs: 'claws', tail: 'flame', aura: 'flames' }, { hue: 1, pattern: 2, seed: 9, size: 1, shiny: false })
  const C = makeGenome({ body: 'patch', head: 'horned', eyes: 'trio', limbs: 'bat', tail: 'spade', aura: 'moons' }, { hue: 5, pattern: 3, seed: 21, size: 2, shiny: true })
  const draw = (gn: any, x: number, y: number, s: number, mood: any, t = 1.2) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); drawCreature(ctx, gn, { t, mood }); ctx.restore() }
  draw(A, 120, 830, 1.45, 'scared', 0.6)
  draw(B, 905, 830, 1.45, 'scared', 1.9)
  draw(C, 512, 830, 1.65, 'shout', 1.4)
  // title
  ctx.textAlign = 'center'; ctx.lineJoin = 'round'
  const title = (s: string, y: number, size: number, fill: string) => {
    ctx.font = `${size}px "Lilita One"`
    ctx.lineWidth = 22; ctx.strokeStyle = '#150830'; ctx.strokeText(s, 512, y)
    ctx.fillStyle = fill; ctx.fillText(s, 512, y)
  }
  title('MASH-UP', 140, 140, '#b6ff3c')
  title('LAB', 262, 140, '#ff5fb8')
  ctx.font = '48px "Lilita One"'; ctx.lineWidth = 12; ctx.strokeStyle = '#150830'
  ctx.strokeText('FUSE. REVEAL. COLLECT.', 512, 960); ctx.fillStyle = '#ffd84a'; ctx.fillText('FUSE. REVEAL. COLLECT.', 512, 960)
  ;(window as any).__done = true
}
void main()
