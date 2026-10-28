// usage: node scripts/shot.mjs <url> <out.png> [w] [h] [waitFlag]
import { chromium } from 'playwright-core'
const [url, out, w = '1600', h = '900', flag = ''] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text()) })
p.on('pageerror', (e) => console.log('[pageerror]', e.message))
await p.goto(url, { waitUntil: 'load' })
if (flag) await p.waitForFunction(`window.${flag}`, { timeout: 15000 })
await p.waitForTimeout(400)
await p.screenshot({ path: out, fullPage: true })
await b.close()
