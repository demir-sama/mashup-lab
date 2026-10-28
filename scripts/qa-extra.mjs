// Extra QA: short phone layout, CDP touch drag, ErrorBoundary-free console, X icon visibility.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const base = process.argv[2] || 'http://127.0.0.1:5199/'
const out = process.argv[3] || '/tmp/qax'
fs.mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
const ctx = await b.newContext({ viewport: { width: 390, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const p = await ctx.newPage()
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
p.on('pageerror', (e) => errors.push('pageerror ' + e.message))
await p.goto(base)
await p.waitForSelector('.splash', { state: 'detached', timeout: 20000 })
await p.waitForTimeout(800)
await p.screenshot({ path: `${out}/short-01-lab.png` })
const cdp = await ctx.newCDPSession(p)
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
const card = await p.locator('.card').nth(1).boundingBox()
const cv = await p.locator('canvas.stage').boundingBox()
const sx = card.x + card.width / 2, sy = card.y + card.height / 2
await touch('touchStart', sx, sy)
for (let i = 1; i <= 14; i++) { await touch('touchMove', sx + (cv.x + cv.width * 0.2 - sx) * i / 14, sy + (cv.y + cv.height * 0.6 - sy) * i / 14); await p.waitForTimeout(20) }
await p.screenshot({ path: `${out}/short-02-dragging.png` })
await touch('touchEnd')
await p.waitForTimeout(500)
const chips = await p.locator('.slotchip').count()
console.log(chips === 1 ? 'PASS touch drag places creature' : 'FAIL touch drag (chips=' + chips + ')')
await p.screenshot({ path: `${out}/short-03-placed.png` })
console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'no console errors')
await b.close()
