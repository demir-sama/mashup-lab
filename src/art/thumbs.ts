import { drawCreature } from './creature'
import { genomeOf, type Creature } from '../core/creature'
import { makeGenome, decodeGenome } from '../core/genome'
import { RARITY_INFO, dominantTheme } from '../core/fright'
import { INK } from '../core/palettes'
import { THEME_INFO, type Slot } from '../core/parts'

const cache = new Map<string, string>()
function remember(key: string, make: () => string): string {
  let v = cache.get(key)
  if (!v) {
    v = make()
    if (cache.size > 400) cache.clear()
    cache.set(key, v)
  }
  return v
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

/** Square portrait of a creature (feet at 88% height). Cached; `px` is the backing size. */
export function thumbURL(code: string, px = 192, mood: 'idle' | 'happy' = 'idle'): string {
  return remember(`t${px}${mood}${code}`, () => {
    const g = decodeGenome(code)
    if (!g) return ''
    const [c, ctx] = canvas(px, px)
    const s = px / 340
    ctx.translate(px / 2, px * 0.9)
    ctx.scale(s, s)
    drawCreature(ctx, g, { t: 1.7, mood, shadow: true, noAura: false, blink: 0 })
    return c.toDataURL('image/png')
  })
}

/** Dark cut-out for undiscovered codex entries. */
export function silhouetteURL(code: string, px = 192): string {
  return remember(`s${px}${code}`, () => {
    const g = decodeGenome(code)
    if (!g) return ''
    const [c, ctx] = canvas(px, px)
    const [tmp, tctx] = canvas(px, px)
    const s = px / 340
    tctx.translate(px / 2, px * 0.9)
    tctx.scale(s, s)
    drawCreature(tctx, g, { t: 1.7, shadow: false, blink: 0 })
    ctx.drawImage(tmp, 0, 0)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = '#1c0b38'
    ctx.fillRect(0, 0, px, px)
    ctx.globalCompositeOperation = 'source-over'
    return c.toDataURL('image/png')
  })
}

const ICON_BASE: Record<Slot, string> = { body: 'blob', head: 'dome', eyes: 'pair', limbs: 'stubs', tail: 'lizard', aura: 'none' }
const ZOOM: Record<Slot, { z: number; y: number }> = {
  body: { z: 0.95, y: -118 },
  head: { z: 1.7, y: -180 },
  eyes: { z: 2.5, y: -182 },
  limbs: { z: 1.0, y: -110 },
  tail: { z: 1.05, y: -105 },
  aura: { z: 0.95, y: -118 },
}
/** Icon for one part: a neutral creature wearing it, zoomed on the relevant area. */
export function partIconURL(slot: Slot, partId: string, px = 128): string {
  return remember(`p${px}${slot}${partId}`, () => {
    const parts = { ...ICON_BASE, body: slot === 'body' ? partId : 'egg', [slot]: partId } as Record<Slot, string>
    if (slot !== 'head') parts.head = slot === 'eyes' ? 'dome' : parts.head
    const g = makeGenome(parts, { hue: 4, pattern: 0, seed: 11 })
    const [c, ctx] = canvas(px, px)
    const z = ZOOM[slot]
    const s = (px / 340) * z.z
    ctx.translate(px / 2, px / 2 - z.y * s)
    ctx.scale(s, s)
    drawCreature(ctx, g, { t: 1.7, shadow: false, blink: 0, noAura: false, mood: 'happy' })
    return c.toDataURL('image/png')
  })
}

// ---------- share card ----------

export async function loadFonts() {
  try {
    await Promise.all([document.fonts.load('64px "Lilita One"'), document.fonts.load('700 32px "Nunito"'), document.fonts.load('900 32px "Nunito"')])
  } catch {
    /* fall back to system fonts */
  }
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, stroke = INK, lw = 14) {
  ctx.lineJoin = 'round'
  ctx.lineWidth = lw
  ctx.strokeStyle = stroke
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

export async function renderCard(c: Creature, opts: { headline?: string; footer?: string; handle?: string } = {}): Promise<Blob> {
  await loadFonts()
  const W = 1080
  const H = 1350
  const [cv, ctx] = canvas(W, H)
  const info = RARITY_INFO[c.rarity]
  const g = genomeOf(c)
  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#3a1a6e')
  bg.addColorStop(1, '#12062a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.translate(W / 2, 640)
  for (let i = 0; i < 22; i++) {
    ctx.rotate((Math.PI * 2) / 22)
    ctx.fillStyle = i % 2 ? info.color + '22' : info.color + '0a'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-90, -1100)
    ctx.lineTo(90, -1100)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  const halo = ctx.createRadialGradient(W / 2, 640, 40, W / 2, 640, 560)
  halo.addColorStop(0, info.glow + 'aa')
  halo.addColorStop(0.5, info.color + '33')
  halo.addColorStop(1, 'transparent')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, W, H)
  // dots
  ctx.fillStyle = 'rgba(255,255,255,.07)'
  for (let y = 20; y < H; y += 54) for (let x = (y / 54) % 2 ? 20 : 47; x < W; x += 54) ctx.fillRect(x, y, 6, 6)
  // frame
  ctx.lineWidth = 14
  ctx.strokeStyle = INK
  rr(ctx, 22, 22, W - 44, H - 44, 56)
  ctx.stroke()
  ctx.lineWidth = 5
  ctx.strokeStyle = info.color
  rr(ctx, 36, 36, W - 72, H - 72, 46)
  ctx.stroke()
  // header
  ctx.textAlign = 'center'
  ctx.font = '82px "Lilita One", Impact, sans-serif'
  outlined(ctx, 'MASH-UP LAB', W / 2, 150, '#ffd84a', INK, 18)
  ctx.font = '800 34px Nunito, system-ui, sans-serif'
  outlined(ctx, opts.headline ?? 'I fused a brand-new monster!', W / 2, 205, '#ffffff', INK, 9)
  // creature
  ctx.save()
  ctx.translate(W / 2, 1000)
  ctx.scale(3.1, 3.1)
  drawCreature(ctx, g, { t: 2.1, mood: 'shout', blink: 0, glow: info.glow })
  ctx.restore()
  // name plate
  ctx.save()
  ctx.translate(W / 2, 1075)
  ctx.rotate(-0.025)
  rr(ctx, -430, -64, 860, 128, 36)
  ctx.fillStyle = INK
  ctx.fill()
  rr(ctx, -418, -54, 836, 108, 28)
  const plate = ctx.createLinearGradient(0, -54, 0, 54)
  plate.addColorStop(0, '#ffffff')
  plate.addColorStop(1, '#e8dcff')
  ctx.fillStyle = plate
  ctx.fill()
  ctx.fillStyle = INK
  const nm = c.name
  let fs = 78
  ctx.font = `${fs}px "Lilita One", Impact, sans-serif`
  while (ctx.measureText(nm).width > 780 && fs > 40) {
    fs -= 4
    ctx.font = `${fs}px "Lilita One", Impact, sans-serif`
  }
  ctx.textBaseline = 'middle'
  ctx.fillText(nm, 0, 4)
  ctx.restore()
  ctx.textBaseline = 'alphabetic'
  ctx.font = '900 34px Nunito, system-ui, sans-serif'
  ctx.fillStyle = '#e7dcff'
  ctx.fillText(`${c.title}  •  ${THEME_INFO[dominantTheme(g)].label}`, W / 2, 1190)
  // fright badge
  ctx.save()
  ctx.translate(W - 190, 330)
  ctx.rotate(0.12)
  ctx.beginPath()
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const r = i % 2 ? 118 : 148
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fillStyle = INK
  ctx.fill()
  ctx.scale(0.93, 0.93)
  ctx.fillStyle = info.color
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.translate(W - 190, 330)
  ctx.rotate(0.12)
  ctx.font = '900 30px Nunito, sans-serif'
  outlined(ctx, 'FRIGHT', 0, -34, '#fff', INK, 8)
  ctx.font = '96px "Lilita One", Impact, sans-serif'
  outlined(ctx, String(c.fright), 0, 50, '#fff', INK, 14)
  ctx.restore()
  // rarity ribbon
  ctx.save()
  ctx.translate(190, 330)
  ctx.rotate(-0.1)
  rr(ctx, -150, -40, 300, 80, 24)
  ctx.fillStyle = INK
  ctx.fill()
  rr(ctx, -142, -33, 284, 66, 18)
  ctx.fillStyle = info.color
  ctx.fill()
  ctx.font = '44px "Lilita One", Impact, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK
  ctx.fillText(info.label.toUpperCase(), 0, 3)
  ctx.restore()
  // footer
  ctx.textBaseline = 'alphabetic'
  ctx.font = '900 38px Nunito, sans-serif'
  outlined(ctx, opts.footer ?? 'Think you can beat it? Mash your own!', W / 2, 1272, '#ffd84a', INK, 10)
  return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('card'))), 'image/png'))
}
