// 終わりの場面と結果を実時間で撮る。node tools/shot2.mjs
import '../mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname, PORT = 5904
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: process.env.LOC || 'ja-JP', viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) } }); await muteContext(ctx)
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/?notut=1&seed=3`); await p.waitForFunction(() => window.__okanReady)
await p.click('#bStart'); await p.evaluate(() => { okan.dbg.G.score = 24; okan.dbg.G.perfect = 7; okan.dbg.G.ok = 2; okan.dbg.G.breach = 2; okan.dbg.G.granny = 1; okan.dbg.endNow() })
await p.waitForTimeout(3200); await p.screenshot({ path: ROOT + 'shots/e-end.png' })
await p.waitForTimeout(3500); await p.screenshot({ path: ROOT + 'shots/e-result.png' })
console.log(errs.join('\n') || 'no errors'); await b.close(); server.kill()
