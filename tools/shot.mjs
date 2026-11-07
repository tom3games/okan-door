// その場の確認用スクショ。node tools/shot.mjs [w] [h] [script...]
import '../mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname
const PORT = 5902
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const w = +(process.argv[2] || 390), h = +(process.argv[3] || 844)
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: w, height: h }, deviceScaleFactor: 1 })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) })
p.on('requestfailed', r => errs.push('reqfail ' + r.url()))
await p.goto(`http://localhost:${PORT}/?notut=1&seed=5`); await p.waitForFunction(() => window.__okanReady, null, { timeout: 15000 })
await p.waitForTimeout(600)
await p.screenshot({ path: ROOT + 'shots/s-title.png' })
for (const [i, js] of process.argv.slice(4).entries()) { const r = await p.evaluate(js); if (r !== undefined) console.log('eval', i, JSON.stringify(r)); await p.waitForTimeout(300); await p.screenshot({ path: ROOT + `shots/s-${i}.png` }) }
console.log(errs.join('\n') || 'no errors')
await b.close(); server.kill()
