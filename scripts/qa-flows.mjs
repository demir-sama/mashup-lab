// Behavioural QA: drag/drop, rush challenge link, pen-full swap, orders, creature modal, reduced motion.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const base = process.argv[2] || 'http://127.0.0.1:5199/'
const out = process.argv[3] || '/tmp/qaf'
fs.mkdirSync(out, { recursive: true })
const errors = []
const results = []
const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); }
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })

async function open(name, vp, url = base, mobile = false, extra = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, ...extra })
  const p = await ctx.newPage()
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`) })
  p.on('pageerror', (e) => errors.push(`[${name}] pageerror ${e.message}`))
  await p.goto(url, { waitUntil: 'load' })
  await p.waitForSelector('.splash', { state: 'detached', timeout: 20000 })
  await p.waitForTimeout(500)
  return { ctx, p, shot: (n) => p.screenshot({ path: `${out}/${name}-${n}.png` }) }
}
const click = (p, sel, i = 0) => p.locator(sel).nth(i).click({ force: true })
async function skipTut(p) {
  if (await p.locator('.tut-skip').count()) await click(p, '.tut-skip')
  await p.waitForTimeout(1100)
  if (await p.locator('.sheet').count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(400) }
}
async function mash(p) {
  const cards = p.locator('.card:not(.sel)')
  await cards.nth(0).click({ force: true })
  await p.waitForTimeout(250)
  await p.locator('.card:not(.sel)').nth(0).click({ force: true })
  await p.waitForTimeout(450)
  await click(p, '.mash')
  try { await p.waitForSelector('.reveal', { timeout: 20000 }) } catch (e) { await p.screenshot({ path: `${out}/FAIL-mash.png` }); results.push('FAIL mash: no reveal'); console.log(results.join('\n')); console.log(errors.join('\n')); process.exit(1) }
  await p.waitForTimeout(900)
  if (await p.locator('.rv-full').count()) return 'full'
  await click(p, '.reveal .btn-slime')
  await p.waitForTimeout(500)
  if (await p.locator('.sheet').count()) return 'modal'
  return 'ok'
}

// 1. desktop: drag & drop + creature modal + orders + settings (fast fusion) + pen full + swap
{
  const { ctx, p, shot } = await open('d', { width: 1440, height: 900 })
  await skipTut(p)
  const card = await p.locator('.card').nth(2).boundingBox()
  const cv = await p.locator('canvas.stage').boundingBox()
  await p.mouse.move(card.x + 30, card.y + 40)
  await p.mouse.down()
  await p.mouse.move(card.x - 60, card.y + 10, { steps: 5 })
  await p.mouse.move(cv.x + cv.width * 0.2, cv.y + cv.height * 0.6, { steps: 12 })
  await p.waitForTimeout(200)
  await shot('drag-hover')
  await p.mouse.up()
  await p.waitForTimeout(500)
  ok('drag-drop places creature on pedestal', (await p.locator('.slotchip').count()) === 1)
  await shot('drag-dropped')
  await click(p, '.sc-name')
  await p.waitForTimeout(600)
  await shot('creature-modal')
  ok('creature modal opens', (await p.locator('.sheet .cm').count()) === 1)
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  // quick fusions
  await click(p, '.gear'); await p.waitForTimeout(400)
  await p.locator('.tgl', { hasText: 'Quick fusions' }).click(); await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  await click(p, '.ctl-clear')
  let r = ''
  for (let i = 0; i < 9 && r !== 'full'; i++) r = await mash(p)
  ok('pen fills and shows full dialog', r === 'full')
  await shot('pen-full')
  await p.locator('.rv-full .btn-violet').click(); await p.waitForTimeout(600)
  await shot('swap-picker')
  await p.locator('.pickc').nth(0).click(); await p.waitForTimeout(800)
  ok('swap resolves', (await p.locator('.reveal').count()) === 0 && (await p.locator('.tray-c').innerText()).startsWith('12/12'))
  // orders
  await p.locator('.tab', { hasText: 'Orders' }).click(); await p.waitForTimeout(600)
  const del = p.locator('.order .btn-slime')
  if (await del.count()) {
    await del.nth(0).click(); await p.waitForTimeout(500)
    await shot('order-picker')
    await p.locator('.pickc').nth(0).click(); await p.waitForTimeout(900)
    ok('order delivered', (await p.locator('.order.done').count()) === 1)
    await shot('order-done')
  } else results.push('SKIP order deliver (none eligible)')
  await ctx.close()
}

// 2. mobile: challenge link -> rush -> 5 fusions -> end
{
  const { ctx, p, shot } = await open('m', { width: 390, height: 844 }, base + '?c=1&s=rush-2026-10-28&t=210&f=Ann%20Ghoul&n=Gloopzilla', true)
  await shot('challenge-intro')
  ok('challenge modal shows', (await p.locator('.sheet', { hasText: 'Ann Ghoul' }).count()) === 1)
  await p.locator('.sheet .btn-slime').click(); await p.waitForTimeout(800)
  await skipTut(p)
  await shot('rush-start')
  ok('in rush mode', (await p.locator('.rushbar', { hasText: 'Challenge' }).count()) === 1)
  for (let i = 0; i < 5; i++) {
    const r = await mash(p)
    if (i === 0) await shot('rush-after1')
    if (r === 'modal') break
  }
  await p.waitForTimeout(1200)
  await shot('rush-end')
  ok('rush end modal', (await p.locator('.rushend').count()) === 1)
  await p.locator('.rushend .btn-ghost').click(); await p.waitForTimeout(600)
  ok('back to lab after rush', (await p.locator('.rushbar.lab').count()) === 1)
  await ctx.close()
}

// 3. reduced motion
{
  const { ctx, p, shot } = await open('r', { width: 390, height: 844 }, base, true, { reducedMotion: 'reduce' })
  ok('html data-motion reduced', (await p.evaluate(() => document.documentElement.dataset.motion)) === 'reduced')
  await skipTut(p)
  const r = await mash(p)
  ok('fusion works in reduced motion', r === 'ok' || r === 'modal')
  await shot('reduced-after')
  await ctx.close()
}
await b.close()
console.log(results.join('\n'))
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
