// Builds public/thumbnail.jpg (512x512, <1MB) from dev/thumb.html. Needs the dev server on :5199.
import { chromium } from 'playwright-core'
import sharp from 'sharp'
const base = process.argv[2] || 'http://127.0.0.1:5199/'
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 })
await p.goto(base + 'dev/thumb.html')
await p.waitForFunction('window.__done', { timeout: 20000 })
await p.waitForTimeout(300)
const png = await p.screenshot({ type: 'png' })
await b.close()
await sharp(png).resize(512, 512).jpeg({ quality: 88, mozjpeg: true }).toFile('public/thumbnail.jpg')
await sharp(png).toFile('screenshots/key-art-1024.png')
console.log('thumbnail written')
