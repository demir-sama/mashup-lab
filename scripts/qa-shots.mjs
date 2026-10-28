// Full-flow visual QA. usage: node scripts/qa-shots.mjs [baseUrl] [outDir] [only]
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const base = process.argv[2] || 'http://127.0.0.1:5199/'
const out = process.argv[3] || 'screenshots'
const only = process.argv[4] || ''
fs.mkdirSync(out, { recursive: true })
const errors = []
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })

async function session(name, vp, mobile, flow) {
  if (only && !name.startsWith(only)) return
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage()
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`) })
  p.on('pageerror', (e) => errors.push(`[${name}] pageerror ${e.message}`))
  await p.goto(base, { waitUntil: 'load' })
  await p.waitForSelector('.splash', { state: 'detached', timeout: 20000 })
  await p.waitForTimeout(500)
  const shot = (n) => p.screenshot({ path: `${out}/${name}-${n}.png` })
  await flow(p, shot)
  await ctx.close()
}

const tap = async (p, sel, i = 0) => p.locator(sel).nth(i).click({ force: true })
async function fuseOnce(p) {
  await tap(p, '.card', 0)
  await tap(p, '.card', 1)
  await p.waitForTimeout(500)
  await tap(p, '.mash')
}

async function flow(p, shot) {
  await shot('01-lab-tutorial')
  await tap(p, '.card', 0)
  await p.waitForTimeout(450)
  await shot('02-one-picked')
  await tap(p, '.card', 1)
  await p.waitForTimeout(600)
  await shot('03-ready')
  await tap(p, '.mash')
  await p.waitForTimeout(2200)
  await shot('04-mashing')
  await p.waitForSelector('.reveal', { timeout: 15000 })
  await p.waitForTimeout(1500)
  await shot('05-reveal')
  await tap(p, '.reveal .btn-slime')
  await p.waitForTimeout(700)
  await shot('06-gift')
  if (await p.locator('.sheet').count()) {
    await p.locator('.sheet .btn-slime').click()
    await p.waitForTimeout(800)
    await shot('06b-gift-claimed')
    await p.locator('.sheet .btn-sun').click()
    await p.waitForTimeout(500)
  }
  for (const [t, n] of [['Orders', 'orders'], ['Codex', 'codex'], ['Ranks', 'ranks'], ['Shop', 'shop']]) {
    await p.locator('.tab', { hasText: t }).click()
    await p.waitForTimeout(900)
    await shot(`07-${n}`)
  }
  await p.locator('.tab', { hasText: 'Lab' }).click()
  await p.waitForTimeout(500)
  await p.locator('.gear').click()
  await p.waitForTimeout(600)
  await shot('08-settings')
  await p.keyboard.press('Escape')
  await p.waitForTimeout(400)
  await p.locator('.seg button', { hasText: 'Rush' }).click()
  await p.waitForTimeout(700)
  await shot('09-rush-intro')
  await p.locator('.sheet .btn-slime').click()
  await p.waitForTimeout(800)
  await shot('10-rush-lab')
}

await session('mobile', { width: 390, height: 844 }, true, flow)
await session('desktop', { width: 1440, height: 900 }, false, flow)
await b.close()
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
