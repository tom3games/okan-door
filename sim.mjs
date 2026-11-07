// 遊び方ごとの分布。bot を 12 日ずつ早回しで回す。node sim.mjs
// 読む bot（人間の速さ）が一番、何もしない bot が最低になること
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const ROOT = import.meta.dirname
const PORT = 5903
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP' }); await muteContext(ctx)
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}/?notut=1`); await p.waitForFunction(() => window.__okanReady, null, { timeout: 15000 })
await p.addScriptTag({ content: readFileSync(ROOT + '/tools/bot.js', 'utf8') })
const BOTS = ['reader', 'hold', 'sleep', 'reply', 'hide', 'random', 'none'], N = Number(process.env.N || 12)
const rows = await p.evaluate(({ BOTS, N }) => {
  okan.dbg.pause(true)
  const out = {}
  for (const name of BOTS) { out[name] = []; for (let s = 1; s <= N; s++) out[name].push(okan.simRun(window.BOTS[name], 1000 + s * 7919)) }
  return out
}, { BOTS, N })
const avg = a => a.reduce((x, y) => x + y, 0) / a.length
const table = []
for (const name of BOTS) {
  const r = rows[name]
  table.push({ bot: name, score: +avg(r.map(x => x.score)).toFixed(1), min: Math.min(...r.map(x => x.score)), max: Math.max(...r.map(x => x.score)), perfect: +avg(r.map(x => x.perfect)).toFixed(1), held: +avg(r.map(x => x.perfect + x.ok)).toFixed(1), breach: +avg(r.map(x => x.breach)).toFixed(1), cleared: r.filter(x => x.breach <= 2).length + '/' + r.length, sec: avg(r.map(x => x.sec)).toFixed(0) })
}
console.table(table)
const sc = Object.fromEntries(table.map(t => [t.bot, t.score]))
const ok1 = Object.entries(sc).every(([k, v]) => k === 'reader' || v < sc.reader)
const ok2 = Object.entries(sc).every(([k, v]) => k === 'none' || v > sc.none)
const minR = Math.min(...rows.reader.map(x => x.score)), maxOther = Math.max(...BOTS.filter(k => k !== 'reader').flatMap(k => rows[k].map(x => x.score)))
// 同じ種なら同じ結果（乱数で当たり外れを決めていない）
const again = await p.evaluate(() => [okan.simRun(window.BOTS.reader, 1000 + 7919).score, okan.simRun(window.BOTS.reader, 1000 + 7919).score])
console.log(`読む bot が一番: ${ok1 ? 'OK' : 'NG'} / 何もしないが最低: ${ok2 ? 'OK' : 'NG'} / 読む bot の最低点 ${minR} > ほかの最高点 ${maxOther}: ${minR > maxOther ? 'OK' : 'NG'} / 同じ種で同じ点: ${again[0] === again[1] ? 'OK' : 'NG'}`)
const rr = rows.reader.flatMap(x => x.log).filter(l => l.kind === 'breach'); console.log('読む bot が入られた手口:', JSON.stringify(rr.slice(0, 8)))
console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no errors')
await b.close(); server.kill()
process.exit(ok1 && ok2 && again[0] === again[1] && !errs.length ? 0 : 1)
