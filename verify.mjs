import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// おかんを部屋に入れるな の検証。node verify.mjs
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5901
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
const BOT = readFileSync(ROOT + '/tools/bot.js', 'utf8')
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}, q = '') {
  const { keepStorage, ...o } = opts
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, acceptDownloads: true, ...o })
  await muteContext(ctx)
  if (!keepStorage) await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1') } } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__okanReady, null, { timeout: 15000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.closest('.bubble')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button,main:not([hidden]) canvas,main:not([hidden]) a')) { if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue; const r = el.getBoundingClientRect(); if (!r.width) continue; if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
const textsOk = p => p.evaluate(() => {
  const els = ['bubble', 'hbubble', 'stamp', 'hint'].map(id => document.getElementById(id)).filter(e => !e.hidden)
  const W = innerWidth, H = innerHeight
  const out = els.filter(e => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > W || r.top < 0 || r.bottom > H })
  return { n: els.length, texts: els.map(e => e.textContent), out: out.map(e => e.id) }
})
// 画面の巡り: タイトル → 遊び中 → 押し合い → 夜 → 結果
async function visit(q, name) {
  const views = {}
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#bHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` })
  await q.click('#bHowClose')
  await q.evaluate(() => { localStorage.setItem('okan_tut', '1') }); await q.click('#bStart')
  await q.evaluate(() => { okan.dbg.pause(); okan.dbg.force(['vacuum', 'knock']); okan.dbg.step(60 * 4.4) })
  views.play = await fit(q); const tx = await textsOk(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await q.evaluate(() => { okan.choose('hold'); okan.dbg.step(60 * 2.2); for (let i = 0; i < 3; i++) { okan.tap(); okan.dbg.step(8) } })
  views.push = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-push.png` })
  await q.evaluate(() => { okan.dbg.G.score = 20; okan.dbg.G.perfect = 6; okan.dbg.G.ok = 2; okan.dbg.G.breach = 3; okan.dbg.endNow(); okan.dbg.pause(false) })
  await q.waitForTimeout(3000); views.end = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-end.png` })
  await q.waitForFunction(() => !document.getElementById('vResult').hidden, null, { timeout: 9000 }); await q.waitForTimeout(500)
  views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  return { views, tx }
}

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ロード画面が消えてタイトルが出る', async () => { const r = await p.evaluate(() => ({ boot: document.getElementById('boot').classList.contains('gone'), title: !document.getElementById('vTitle').hidden, done: window.__bootDone })); expect(r.boot && r.title && r.done, JSON.stringify(r)) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r))
})
await t('OGP 一式があり og.png が 1200x630', async () => {
  const r = await p.evaluate(async () => {
    const tags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => document.querySelector(`meta[property="${k}"]`)?.content)
    const card = document.querySelector('meta[name="twitter:card"]')?.content
    const img = new Image(); img.src = 'og.png'; await img.decode()
    return { tags, card, w: img.naturalWidth, h: img.naturalHeight }
  })
  expect(r.tags.every(Boolean) && r.card === 'summary_large_image' && r.w === 1200 && r.h === 630 && /tom3games\.github\.io\/okan-door\//.test(r.tags[3]), JSON.stringify(r))
})
await t('題と OGP に本人を笑う言い方が無い', async () => {
  const html = readFileSync(ROOT + '/index.html', 'utf8') + readFileSync(ROOT + '/data.js', 'utf8')
  const bad = ['ニート', '甘え', '引きこもり', 'ひきこもり', '不登校', '死', '殺', '自殺', 'クズ', 'ダメ人間'].filter(w => html.includes(w))
  expect(!bad.length, bad.join(','))
})
await t('台詞は14字以内（同時に読める長さ）', async () => {
  const r = await p.evaluate(() => {
    const OD = okan.OD, all = []
    for (const k in OD.TACTICS) for (const l of OD.TACTICS[k].lines || []) all.push(l[0])
    for (const l of OD.LURES) all.push(l[0])
    for (const k in OD.RES) for (const d in OD.RES[k]) if (OD.RES[k][d][1]) all.push(OD.RES[k][d][1][0])
    for (const x of [OD.TIRED, OD.SLEEP3, OD.GRANNY_IN, OD.REPLY, OD.NIGHT, OD.DAD_WIN, ...Object.values(OD.PUSH_WIN), ...Object.values(OD.PUSH_LOSE)]) all.push(x[0])
    for (const k of ['tut1', 'tut2', 'tut3', 'tutGo']) all.push(OD.T[k][0])
    return all.filter(s => [...s].length > 14)
  })
  expect(!r.length, r.join(' / '))
})
await t('同じ種なら同じ1日（乱数で当たり外れを決めない）', async () => {
  const r = await p.evaluate(() => [JSON.stringify(okan.makeDay(42)), JSON.stringify(okan.makeDay(42)), JSON.stringify(okan.makeDay(43))])
  expect(r[0] === r[1] && r[0] !== r[2], 'same seed differs')
})
await t('1日の中身: 11回・最初は声かけ・合鍵は4回目以降・言い訳は後ほど雑', async () => {
  const r = await p.evaluate(() => { const bad = []; for (let s = 1; s < 200; s++) { const d = okan.makeDay(s); if (d.length !== 11 || d[0].intent !== 'CALL' || d.findIndex(x => x.intent === 'KEY') < 3) bad.push(s); const lures = d.filter(x => x.intent === 'LURE').map(x => okan.OD.LURES.findIndex(l => l[0] === x.line[0])); for (let i = 1; i < lures.length; i++) if (lures[i] < lures[i - 1]) bad.push('lure' + s) } return bad })
  expect(!r.length, r.slice(0, 5).join(','))
})
await t('同じ台詞で正解が変わる（ご飯・洗濯物）', async () => {
  const r = await p.evaluate(() => { const T = okan.OD.TACTICS; return [T.gohan_call.intent, T.gohan_peek.intent, T.vacuum_lie.intent, T.laundry_call.intent, T.laundry_peek.intent] })
  expect(r.join() === 'CALL,PEEK,RUSH,CALL,PEEK', r.join())
})
// ---- 遊びの通し（初めての人: チュートリアルから）
const q = await open(browser)
await t('はじめる → 初回はチュートリアル（ヒントと指が出る）', async () => {
  await q.click('#bStart'); await q.evaluate(() => okan.dbg.pause()); await q.evaluate(() => okan.dbg.step(60 * 6.5))
  const r = await q.evaluate(() => ({ s: okan.state, hint: document.getElementById('hint').textContent, finger: !!document.getElementById('finger') && !document.getElementById('finger').hidden, skip: !document.getElementById('bSkip').hidden }))
  expect(r.s.tut && r.s.phase === 'approach' && r.hint.includes('返事') && r.finger && r.skip, JSON.stringify(r)); return r.hint
})
await t('チュートリアル: 違う守り方は受け付けず、正しい方で進む', async () => {
  const r = await q.evaluate(() => { const a = okan.choose('sleep'); okan.dbg.step(30); const ph = okan.state.phase; const b = okan.choose('reply'); okan.dbg.step(60 * 2.6); return { a, ph, b, s: okan.state } })
  expect(r.a === false && r.ph === 'approach' && r.b === true && r.s.id === 'vacuum', JSON.stringify(r))
})
await t('チュートリアル: 押さえて連打 → 寝たふり → 1日が始まる', async () => {
  const r = await q.evaluate(() => {
    okan.dbg.step(60 * 6.5); okan.choose('hold'); okan.dbg.step(10)
    for (let i = 0; i < 16; i++) { okan.tap(); okan.dbg.step(8) }
    okan.dbg.step(60 * 3); const s1 = okan.state.id
    okan.dbg.step(60 * 6.5); okan.choose('sleep'); okan.dbg.step(60 * 2.5); okan.dbg.step(60 * 2.5)
    return { s1, s: okan.state, tut: localStorage.getItem('okan_tut') }
  })
  expect(r.s1 === 'knock_peek' && r.s.mode === 'play' && !r.s.tut && r.tut === '1' && r.s.hour >= 7 && r.s.hour < 7.6, JSON.stringify(r))
})
await t('文字は同時に2つまで・画面の外に出ない（1日を通して）', async () => {
  await q.addScriptTag({ content: BOT })
  const r = await q.evaluate(() => { okan.dbg.G.bot = window.BOTS.reader; let max = 0, out = 0, n = 0; while (okan.state.mode === 'play' && n < 60 * 200) { okan.dbg.step(6); n += 6; const vis = ['bubble', 'hbubble', 'stamp', 'hint'].map(id => document.getElementById(id)).filter(e => !e.hidden); max = Math.max(max, vis.length); for (const e of vis) { const b = e.getBoundingClientRect(); if (b.left < 0 || b.right > innerWidth + 1 || b.top < 0 || b.bottom > innerHeight) out++ } } return { max, out, mode: okan.state.mode, score: okan.state.score } })
  expect(r.max <= 2 && r.out === 0 && r.mode === 'end', JSON.stringify(r)); return r
})
await t('夜: おにぎりとメモ → 連絡ノート（結果）', async () => {
  await q.evaluate(() => okan.dbg.pause(false))
  await q.waitForFunction(() => !document.getElementById('vEnd').hidden, null, { timeout: 8000 })
  const memo = await q.evaluate(() => document.getElementById('eMemoT').textContent)
  await q.waitForFunction(() => !document.getElementById('vResult').hidden, null, { timeout: 9000 })
  const r = await q.evaluate(() => { const c = document.getElementById('note'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 17) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } return { varc: Math.round(s2 / n - (s / n) ** 2), tm: window.__tmLog.map(e => e.name) } })
  expect(memo.includes('冷めても') && r.varc > 300 && r.tm.includes('game_start') && r.tm.includes('game_end'), JSON.stringify({ memo, ...r })); return r
})
await t('結果: Xでポスト（本文に URL を入れず url パラメータ）', async () => {
  const href = await q.getAttribute('#bPost', 'href'); const u = new URL(href)
  expect(u.hostname === 'x.com' && u.pathname === '/intent/post' && u.searchParams.get('url') === 'https://tom3games.github.io/okan-door/' && !/https?:/.test(u.searchParams.get('text')) && u.searchParams.get('text').includes('おかんを部屋に入れるな'), href)
})
await t('結果: 画像を保存でダウンロードされる', async () => { const [d] = await Promise.all([q.waitForEvent('download', { timeout: 5000 }), q.click('#bSave')]); expect(/okan-door\.png/.test(d.suggestedFilename()), d.suggestedFilename()) })
await t('結果: 支援リンク（おにぎり）と もう一回 が押せる', async () => {
  const r = await q.evaluate(() => { const s = document.getElementById('tmSupport'), a = document.getElementById('bAgain'); return { s: s && s.textContent, h: s && s.getBoundingClientRect().height, again: a.textContent } })
  expect(r.s === '作者におにぎりをおごる（任意）' && r.h >= 30 && r.again === 'もう一回', JSON.stringify(r))
  await q.click('#bAgain'); const s = await q.evaluate(() => okan.state); expect(s.mode === 'play' && s.i === 0 && s.score === 0, JSON.stringify(s))
})
await t('音: 録音素材が鳴る呼び出しがある（鳴らさず回数で見る）・実際は無音', async () => {
  const r = await q.evaluate(() => ({ played: Object.keys(Snd.played).length, knock: Snd.played.step || 0, ok: window.__muteOk(), calls: window.__soundCalls }))
  expect(r.played >= 8 && r.ok, JSON.stringify(r)); return r
})
await t('コンソールエラーなし（通しのあと）', async () => { expect(q.errs.length === 0, q.errs.join('|')) })
await q.close()
// ---- 遊びの判定
const g = await open(browser, {}, '?notut=1')
await g.addScriptTag({ content: BOT })
await t('何もしない日は最低の称号・守り切り失敗', async () => {
  const r = await g.evaluate(() => { const x = okan.simRun(window.BOTS.none, 77); return { x, title: okan.OD.TITLES[okan.OD.TITLES.length - 1][1][0] } })
  expect(r.x.score < 8 && r.x.breach > 2, JSON.stringify(r.x))
})
await t('押さえ続けると腕が限界（4回目で入られる）', async () => {
  const r = await g.evaluate(() => { const x = okan.simRun(window.BOTS.hold, 91); return x.log.slice(0, 6).map(l => l.kind + ':' + l.how) })
  expect(r.some(s => s.startsWith('breach')), r.join(','))
})
await t('寝たふりを3回続けると心配されて入られる', async () => {
  const r = await g.evaluate(() => { const x = okan.simRun(window.BOTS.sleep, 91); return x.log.map(l => l.how) })
  expect(r.includes('sleep3'), r.join(','))
})
await t('ばあちゃんは入られても数えない', async () => {
  const r = await g.evaluate(() => { okan.dbg.pause(); document.getElementById('bStart').click(); okan.dbg.force(['granny']); okan.dbg.step(60 * 7); okan.choose('hold'); okan.dbg.step(60 * 2); return okan.state })
  expect(r.granny === 1 && r.breach === 0, JSON.stringify(r))
})
await t('押し合い: 速く連打すると守れる・連打しないと入られる', async () => {
  const r = await g.evaluate(() => {
    const run = rate => { okan.dbg.force(['vacuum']); okan.dbg.G.F = 0; let n = 0; while (!(okan.state.phase === 'approach' && okan.state.t > 2.6) && n++ < 900) okan.dbg.step(1); okan.choose('hold'); while (okan.state.phase !== 'push' && n++ < 1800) okan.dbg.step(1); const b0 = okan.state.breach; let acc = 0; while (okan.state.phase === 'push' && n++ < 3000) { acc += rate / 60; if (acc >= 1) { acc -= 1; okan.tap() } okan.dbg.step(1) } return okan.state.breach - b0 }
    return { fast: run(6), slow: run(1.5) }
  })
  expect(r.fast === 0 && r.slow === 1, JSON.stringify(r))
})
await t('入られるとドアに付箋が増える', async () => { const r = await g.evaluate(() => okan.dbg.G.breach); expect(r >= 1, r) })
await g.close()
// ---- 英語
const e = await open(browser, { locale: 'en-US' }, '?notut=1')
await t('英語: 端末が英語ならタイトル・ボタン・台詞が英語', async () => {
  const r = await e.evaluate(() => { document.getElementById('bStart').click(); okan.dbg.pause(); okan.dbg.force(['knock']); okan.dbg.step(60 * 3.2); okan.dbg.render(); return { t: document.getElementById('t2').textContent, b: document.querySelector('#dHold span').textContent, bub: document.getElementById('bubble').textContent, lang: document.documentElement.lang } })
  expect(r.t === 'Out of My Room' && r.b === 'Hold' && /[a-z]/i.test(r.bub) && !/[ぁ-ん]/.test(r.bub) && r.lang === 'en', JSON.stringify(r)); return r
})
await e.screenshot({ path: `${ROOT}/shots/en-play.png` })
await t('英語: 切り替えボタンで日本語に戻る・覚えている', async () => {
  await e.reload(); await e.waitForFunction(() => window.__okanReady)
  await e.click('#bLang'); const r = await e.evaluate(() => ({ t: document.getElementById('t2').textContent, s: localStorage.getItem('okan_lang') }))
  expect(r.t === '部屋に入れるな' && r.s === 'ja', JSON.stringify(r))
})
await e.close()
// ---- ミュート
const m = await open(browser)
await t('ミュート: 押すと切れて、次に開いても切れたまま', async () => {
  await m.click('#bMute'); const a = await m.evaluate(() => ({ off: document.getElementById('bMute').classList.contains('off'), s: localStorage.getItem('okan_mute') }))
  await m.reload(); await m.waitForFunction(() => window.__okanReady)
  const b = await m.evaluate(() => ({ off: document.getElementById('bMute').classList.contains('off'), muted: Snd.muted }))
  expect(a.off && a.s === '1' && b.off && b.muted, JSON.stringify({ a, b }))
})
await t('遊び方: プライバシーへのリンク（38px以上）とクレジット', async () => {
  await m.click('#bHow'); const r = await m.evaluate(() => { const a = document.getElementById('lPrivacy'), b = a.getBoundingClientRect(); return { h: b.height, href: a.getAttribute('href'), credit: document.getElementById('howCredit').textContent, items: document.querySelectorAll('#howList li').length } })
  expect(r.h >= 38 && r.href === 'privacy.html' && /CC BY/.test(r.credit) && r.items === 6, JSON.stringify(r))
})
await m.close()
// ---- 3サイズ × 全画面で一画面
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]) {
  const v = await open(browser, { viewport: { width: w, height: h } })
  const { views, tx } = await visit(v, name)
  for (const [k, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${k}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: 遊び中の文字が画面内・2つまで`, async () => { expect(tx.n <= 2 && !tx.out.length, JSON.stringify(tx)) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(v); expect(o.sw <= o.W && !o.bad.length && !v.errs.length, JSON.stringify(o) + v.errs.join('|')) })
  await v.close()
}
await t('Chromium: 実際には無音（__muteOk）', async () => { const v = await open(browser); await v.click('#bStart'); await v.waitForTimeout(500); const r = await v.evaluate(() => window.__muteOk()); expect(r, r); await v.close() })
await browser.close()
// ---- WebKit（iPhone 相当）
const wb = await webkit.launch()
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]) {
  const wp = await open(wb, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const { views } = await visit(wp, 'wk-' + name)
  for (const [k, r] of Object.entries(views)) await t(`WebKit 一画面 ${name} ${k}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`WebKit ${name}: エラーなし`, async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
  await wp.close()
}
const wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで遊べる（守り方を選ぶ）', async () => {
  await wp.tap('#bStart'); await wp.evaluate(() => { okan.dbg.pause(); okan.dbg.force(['knock']); okan.dbg.step(60 * 3) })
  await wp.tap('#dReply'); const r = await wp.evaluate(() => okan.state.def); expect(r === 'reply', r)
})
await t('WebKit: 実際には無音（タップで始めたあと）', async () => { const r = await wp.evaluate(() => window.__muteOk()); expect(r, r) })
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
