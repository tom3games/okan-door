import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = process.env.URL0 || 'https://tom3games.github.io/okan-door/'
const BOT = readFileSync(new URL('./tools/bot.js', import.meta.url), 'utf8')
const out = []
let bad = 0
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errs.push('fail ' + r.url()) })
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__okanReady, null, { timeout: 20000 })
  // 遊びの通し: はじめる → チュートリアルをとばす → 手口を読む bot で1日を早回し → 夜 → 連絡ノート
  const tapOrClick = sel => name === 'webkit' ? p.tap(sel) : p.click(sel)
  await tapOrClick('#bStart'); await p.waitForTimeout(300)
  const tut = await p.evaluate(() => !document.getElementById('bSkip').hidden)
  if (tut) await tapOrClick('#bSkip')
  await p.addScriptTag({ content: BOT })
  await p.evaluate(() => { okan.dbg.G.bot = window.BOTS.reader; okan.dbg.speed(12) })
  await p.waitForFunction(() => okan.state.mode === 'end' || okan.state.mode === 'result', null, { timeout: 60000 })
  await p.evaluate(() => okan.dbg.speed(1))
  await p.waitForFunction(() => !document.getElementById('vResult').hidden, null, { timeout: 15000 })
  await p.waitForTimeout(600)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const r = await p.evaluate(async () => {
    const og = await fetch(document.querySelector('meta[property="og:image"]').content).then(r => r.status + ' ' + r.headers.get('content-type'), e => 'fetch-failed ' + e.message)
    return { og, score: okan.state.score, post: document.getElementById('bPost').href.startsWith('https://x.com/intent/post'), support: !!document.getElementById('tmSupport'), mute: window.__muteOk() }
  })
  const ok = /^200 image\/png/.test(r.og) && r.post && r.support && r.mute && !errs.length
  if (!ok) bad++
  out.push(`${name}: ${ok ? 'OK' : 'NG'} tut=${tut} ${JSON.stringify(r)} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(bad ? 1 : 0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/okan-door', 'https://github.com/tom3games/okan-door/commits/main', 'https://github.com/tom3games/okan-door/activity']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  const found = OWNER && (await p.content()).toLowerCase().includes(OWNER)
  if (found) bad++
  out.push(`${u} status=${res.status()} owner=${found ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
process.exit(bad ? 1 : 0)
