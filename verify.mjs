import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
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
  const els = ['bubble', 'hbubble', 'sticky', 'hint'].map(id => document.getElementById(id)).filter(e => !e.hidden)
  const W = innerWidth, H = innerHeight
  const out = els.filter(e => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > W || r.top < 0 || r.bottom > H })
  return { n: els.length, texts: els.map(e => e.textContent), out: out.map(e => e.id) }
})
// 本物の指で押す（要素の中心の座標を押す。内部の関数は呼ばない）
async function press(q, sel, touch) {
  const r = await q.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, ok: b.width > 30 && b.top >= 0 && b.bottom <= innerHeight } }, sel)
  if (!r.ok) throw new Error('button off screen ' + sel + JSON.stringify(r))
  if (touch) await q.touchscreen.tap(r.x, r.y); else await q.mouse.click(r.x, r.y)
  return r
}
const BTN = { hold: '#dHold', sleep: '#dSleep', reply: '#dReply', hide: '#dHide' }
// 印が出るまで（＋n 秒）進める
const toTell = (q, n = 0.9) => q.evaluate(n => { let k = 0; while (!(okan.state.phase === 'tell' && okan.state.t >= n) && k++ < 1200) okan.dbg.step(1); return okan.state }, n)
// 画面の巡り: タイトル → 遊び方 → 印（寄り）→ 答え合わせ → 押し合い → 夜 → 結果
async function visit(q, name, touch) {
  const views = {}
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await press(q, '#bHow', touch); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` })
  await press(q, '#bHowClose', touch)
  await q.evaluate(() => { localStorage.setItem('okan_tut2', '1') }); await press(q, '#bStart', touch)
  await q.evaluate(() => { okan.dbg.pause(); okan.dbg.force(['vacuum', 'knock']) })
  await toTell(q, 0.9)
  views.tell = await fit(q); const tx = await textsOk(q); const ts = await q.evaluate(() => okan.dbg.tellScreen()); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-tell.png` })
  await press(q, '#dHold', touch); await q.evaluate(() => okan.dbg.step(40))
  for (let i = 0; i < 4; i++) { await press(q, '#dHold', touch); await q.evaluate(() => okan.dbg.step(9)) }
  views.push = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-push.png` })
  for (let i = 0; i < 12; i++) { await press(q, '#dHold', touch); await q.evaluate(() => okan.dbg.step(9)) }
  await q.evaluate(() => okan.dbg.step(30))
  views.answer = await fit(q); const tx2 = await textsOk(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-answer.png` })
  await q.evaluate(() => { okan.dbg.G.score = 21; okan.dbg.G.perfect = 7; okan.dbg.G.ok = 0; okan.dbg.G.breach = 3; okan.dbg.endNow(); okan.dbg.pause(false) })
  await q.waitForTimeout(3000); views.end = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-end.png` })
  await q.waitForFunction(() => !document.getElementById('vResult').hidden, null, { timeout: 9000 }); await q.waitForTimeout(500)
  views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  return { views, tx, tx2, ts }
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
await t('台詞は14字以内・ヒントと付箋は12字以内', async () => {
  const r = await p.evaluate(() => {
    const OD = okan.OD, all = [], short = []
    for (const k in OD.TACTICS) for (const l of OD.TACTICS[k].lines) all.push(l[0])
    for (const l of OD.FAKES) all.push(l[0])
    for (const k in OD.RES) for (const d in OD.RES[k]) all.push(OD.RES[k][d][0])
    for (const x of [OD.GRANNY_IN, OD.REPLY, OD.NIGHT, OD.DAD_WIN, OD.PUSH_WIN, OD.PUSH_LOSE]) all.push(x[0])
    for (const k of ['tutCALL', 'tutRUSH', 'tutPEEK', 'tutKEY', 'tutMash', 'tutGo']) short.push(OD.T[k][0])
    for (const k in OD.STICKY) for (const l of OD.STICKY[k]) short.push(l[0])
    return [...all.filter(s => [...s].length > 14), ...short.filter(s => [...s].length > 12)]
  })
  expect(!r.length, r.join(' / '))
})
await t('手口4つと守り方4つが1対1（印も4つ）', async () => {
  const r = await p.evaluate(() => { const O = okan.OD, ints = ['RUSH', 'PEEK', 'CALL', 'KEY']; return { d: ints.map(i => O.ANSWER[i]), v: ints.map(i => O.TELL[i]), tacts: Object.values(O.TACTICS).map(x => x.intent) } })
  expect(new Set(r.d).size === 4 && new Set(r.v).size === 4 && r.tacts.every(i => ['RUSH', 'PEEK', 'CALL', 'KEY', 'GRANNY'].includes(i)), JSON.stringify(r))
})
await t('同じ種なら同じ1日（乱数で当たり外れを決めない）', async () => {
  const r = await p.evaluate(() => [JSON.stringify(okan.makeDay(42)), JSON.stringify(okan.makeDay(42)), JSON.stringify(okan.makeDay(43))])
  expect(r[0] === r[1] && r[0] !== r[2], 'same seed differs')
})
await t('1日の中身: 11回・最初は声かけ・朝5回で4つの手口が出る・うその台詞は6回目から・続けて来るのは8回目から', async () => {
  const r = await p.evaluate(() => { const bad = []; let fakes = 0, quick = 0; for (let s = 1; s < 300; s++) { const d = okan.makeDay(s); if (d.length !== 11 || d[0].intent !== 'CALL' || new Set(d.slice(0, 5).map(x => x.intent)).size < 4) bad.push(s); d.forEach((x, i) => { if (x.fake) { fakes++; if (i < 5) bad.push('fake' + s) } if (x.quick) { quick++; if (i < 7) bad.push('quick' + s) } }) } return { bad: bad.slice(0, 5), fakes, quick } })
  expect(!r.bad.length && r.fakes > 300 && r.quick > 300, JSON.stringify(r)); return { fakes: r.fakes, quick: r.quick }
})
// ---- 遊びの通し（初めての人: チュートリアルから。全部本物の指で押す）
const q = await open(browser)
await t('はじめる → 初回は4つの印を1回ずつ見せる案内（ヒント・指・とばす）', async () => {
  await press(q, '#bStart'); await q.evaluate(() => okan.dbg.pause()); await toTell(q, 0.8)
  const r = await q.evaluate(() => ({ s: okan.state, hint: document.getElementById('hint').textContent, finger: !!document.getElementById('finger') && !document.getElementById('finger').hidden, skip: !document.getElementById('bSkip').hidden, ts: okan.dbg.tellScreen() }))
  expect(r.s.tut && r.s.intent === 'CALL' && r.hint === 'ノックだけなら返事' && r.finger && r.skip && r.ts.vis === 'knock', JSON.stringify(r)); return r.hint
})
await t('案内: 違うボタンは受け付けず、正しいボタンで進む（付箋で答え合わせ）', async () => {
  await press(q, '#dSleep'); await q.evaluate(() => okan.dbg.step(30)); const a = await q.evaluate(() => okan.state)
  await press(q, '#dReply'); await q.evaluate(() => okan.dbg.step(60 * 0.9))
  const r = await q.evaluate(() => ({ s: okan.state, sticky: document.getElementById('sticky').innerText }))
  expect(a.phase === 'tell' && !a.def && r.s.def === 'reply' && /ノックだけ/.test(r.sticky) && /返事/.test(r.sticky), JSON.stringify({ a, r })); return r.sticky.replace(/\n/g, ' ')
})
await t('案内: ガチャガチャ→押さえて連打 → のぞき→寝たふり → 鍵→隠れる → 1日が始まる', async () => {
  const hints = []
  await q.evaluate(() => okan.dbg.step(60 * 3)); await toTell(q, 0.8); hints.push(await q.evaluate(() => document.getElementById('hint').textContent))
  await press(q, '#dHold'); await q.evaluate(() => okan.dbg.step(40)); hints.push(await q.evaluate(() => document.getElementById('hint').textContent))
  for (let i = 0; i < 10; i++) { await press(q, '#dHold'); await q.evaluate(() => okan.dbg.step(8)) }
  await q.evaluate(() => okan.dbg.step(60 * 3)); await toTell(q, 0.8); hints.push(await q.evaluate(() => document.getElementById('hint').textContent)); const s1 = await q.evaluate(() => okan.state.id)
  await press(q, '#dSleep'); await q.evaluate(() => okan.dbg.step(60 * 3.4)); await toTell(q, 0.8); hints.push(await q.evaluate(() => document.getElementById('hint').textContent)); const s2 = await q.evaluate(() => okan.state.id)
  await press(q, '#dHide'); await q.evaluate(() => okan.dbg.step(60 * 3.4)); await q.evaluate(() => okan.dbg.step(60 * 2.2))
  const r = await q.evaluate(() => ({ s: okan.state, tut: localStorage.getItem('okan_tut2') }))
  expect(hints.join() === 'ガチャガチャは押さえる,連打して押し返せ,のぞかれたら寝たふり,鍵が刺さったら隠れる' && s1 === 'peek' && s2 === 'key' && r.s.mode === 'play' && !r.s.tut && r.tut === '1' && r.s.score === 0 && r.s.breach === 0, JSON.stringify({ hints, s1, s2, r })); return hints
})
await t('文字は同時に2つまで・画面の外に出ない（1日を通して）', async () => {
  await q.addScriptTag({ content: BOT })
  const r = await q.evaluate(() => { okan.dbg.G.bot = window.BOTS.reader; let max = 0, out = 0, n = 0; while (okan.state.mode === 'play' && n < 60 * 200) { okan.dbg.step(6); n += 6; const vis = ['bubble', 'hbubble', 'sticky', 'hint'].map(id => document.getElementById(id)).filter(e => !e.hidden); max = Math.max(max, vis.length); for (const e of vis) { const b = e.getBoundingClientRect(); if (b.left < 0 || b.right > innerWidth + 1 || b.top < 0 || b.bottom > innerHeight) out++ } } return { max, out, mode: okan.state.mode, score: okan.state.score } })
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
  const r = await g.evaluate(() => okan.simRun(window.BOTS.none, 77))
  expect(r.score < 6 && r.breach > 2, JSON.stringify(r))
})
await t('いつも押さえる・でたらめは読む人より10点以上低い', async () => {
  const r = await g.evaluate(() => ({ reader: okan.simRun(window.BOTS.reader, 91).score, muted: okan.simRun(window.BOTS.muted, 91).score, hold: okan.simRun(window.BOTS.hold, 91).score, random: okan.simRun(window.BOTS.random, 91).score }))
  expect(r.reader >= 27 && r.muted >= 27 && r.hold <= r.reader - 10 && r.random <= r.reader - 10, JSON.stringify(r)); return r
})
await press(g, '#bStart')
await g.evaluate(() => okan.dbg.pause())
for (const [id, want, label] of [['vacuum', 'hold', 'ガチャガチャ'], ['peek', 'sleep', 'すき間から目'], ['knock', 'reply', 'ノックだけ'], ['key', 'hide', '鍵穴に鍵']]) {
  await t(`印「${label}」: カメラが寄り、書き文字が大きく画面内・時計の赤が見える`, async () => {
    await g.evaluate(id => { okan.dbg.G.breach = 0; okan.dbg.force([id], 3) }, id); await toTell(g, 0.9)
    const r = await g.evaluate(() => okan.dbg.tellScreen())
    expect(r.camK === 1 && r.ono && r.ono.w >= r.W * 0.4 && r.ono.x - r.ono.w / 2 > -r.W * 0.1 && r.ono.x + r.ono.w / 2 < r.W * 1.05 && r.ono.y > 40 && r.ono.y < r.H - 140 && r.clock.x < r.W - 10 && r.clock.y > 0, JSON.stringify(r)); return { ono: r.ono, clock: r.clock }
  })
  await t(`印「${label}」: 正しいボタン（${want}）で守れて、付箋に印と答え`, async () => {
    await press(g, BTN[want]); await g.evaluate(() => okan.dbg.step(30))
    if (want === 'hold') { for (let i = 0; i < 16; i++) { await press(g, '#dHold'); await g.evaluate(() => okan.dbg.step(9)) } }
    await g.evaluate(() => okan.dbg.step(30))
    const r = await g.evaluate(() => ({ s: okan.state, st: document.getElementById('sticky').innerText }))
    expect(r.s.phase === 'react' && r.s.breach === 0 && r.st.includes(label) && r.st.includes('守った'), JSON.stringify(r)); return r.st.replace(/\n/g, ' ')
  })
  await t(`印「${label}」: 違うボタンだと入られて、付箋に同じ印と正しい答え`, async () => {
    await g.evaluate(id => { okan.dbg.G.breach = 0; okan.dbg.force([id], 3) }, id); await toTell(g, 0.9)
    const wrong = want === 'reply' ? 'hide' : 'reply'
    await press(g, BTN[wrong]); await g.evaluate(() => okan.dbg.step(60))
    const r = await g.evaluate(() => ({ s: okan.state, st: document.getElementById('sticky').innerText }))
    expect(r.s.breach === 1 && r.st.includes(label) && r.st.includes('入られた'), JSON.stringify(r)); return r.st.replace(/\n/g, ' ')
  })
}
await t('うその台詞（「外にパンダおるで」でも鍵が刺さる）: 印で守れる', async () => {
  await g.evaluate(() => { okan.dbg.G.breach = 0; okan.dbg.force(['key'], 8, { line: ['外にパンダおるで', "There's a panda outside."] }) }); await toTell(g, 0.9)
  const b = await g.evaluate(() => document.getElementById('bubble').textContent)
  await press(g, '#dHide'); await g.evaluate(() => okan.dbg.step(60))
  const r = await g.evaluate(() => okan.state)
  expect(b === '外にパンダおるで' && r.breach === 0 && r.perfect >= 1, JSON.stringify({ b, r }))
})
await t('時間切れ（何も押さない）は「間に合わず」で入られる', async () => {
  await g.evaluate(() => { okan.dbg.G.breach = 0; okan.dbg.force(['knock'], 2) }); await toTell(g, 0.1)
  const w = await g.evaluate(() => okan.state.win)
  await g.evaluate(w => okan.dbg.step(Math.ceil(60 * (w + 0.3))), w)
  const r = await g.evaluate(() => ({ s: okan.state, st: document.getElementById('sticky').innerText }))
  expect(w >= 3.5 && r.s.breach === 1 && r.st.includes('間に合わず') && r.st.includes('ノックだけ'), JSON.stringify({ w, r }))
})
await t('夜は選べる時間が短い（朝4.0秒→夜2.2秒）', async () => {
  const r = await g.evaluate(() => { okan.dbg.force(['knock'], 10); return okan.state.win })
  expect(Math.abs(r - 2.2) < 0.01, r)
})
await t('ばあちゃんは何をしても入るが数えない（付箋にみかん）', async () => {
  await g.evaluate(() => { okan.dbg.G.breach = 0; okan.dbg.G.granny = 0; okan.dbg.force(['granny'], 5) }); await toTell(g, 0.3)
  await press(g, '#dHold'); await g.evaluate(() => okan.dbg.step(60 * 1.5))
  const r = await g.evaluate(() => ({ s: okan.state, cls: document.getElementById('sticky').className }))
  expect(r.s.granny === 1 && r.s.breach === 0 && /mikan/.test(r.cls), JSON.stringify(r))
})
await t('押し合い: 速く連打すると守れる・連打しないと入られる（本物の指で）', async () => {
  const run = async (every) => {
    await g.evaluate(() => { okan.dbg.G.breach = 0; okan.dbg.force(['vacuum'], 3) }); await toTell(g, 0.9)
    await press(g, '#dHold'); await g.evaluate(() => okan.dbg.step(30))
    let n = 0; while ((await g.evaluate(() => okan.state.phase)) === 'push' && n++ < 80) { await press(g, '#dHold'); await g.evaluate(k => okan.dbg.step(k), every) }
    return g.evaluate(() => okan.state.breach)
  }
  const r = { fast: await run(9), slow: await run(40) }
  expect(r.fast === 0 && r.slow === 1, JSON.stringify(r))
})
await t('入られるとドアに付箋が増える', async () => { const r = await g.evaluate(() => okan.dbg.G.breach); expect(r >= 1, r) })
await t('判定のあとも Chromium は無音', async () => { const r = await g.evaluate(() => window.__muteOk()); expect(r, r) })
await t('判定のあいだエラーなし', async () => { expect(g.errs.length === 0, g.errs.join('|')) })
await g.close()
// ---- 英語
const e = await open(browser, { locale: 'en-US' }, '?notut=1')
await t('英語: 端末が英語ならタイトル・ボタン・台詞が英語', async () => {
  const r = await e.evaluate(() => { document.getElementById('bStart').click(); okan.dbg.pause(); okan.dbg.force(['knock']); let k = 0; while (!(okan.state.phase === 'tell' && okan.state.t > 0.5) && k++ < 900) okan.dbg.step(1); okan.dbg.render(); return { t: document.getElementById('t2').textContent, b: document.querySelector('#dHold span').textContent, bub: document.getElementById('bubble').textContent, lang: document.documentElement.lang } })
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
await t('遊び方: 印の絵→ボタンの絵の表が4行・プライバシーへのリンク（38px以上）とクレジット', async () => {
  await m.click('#bHow'); const r = await m.evaluate(() => { const a = document.getElementById('lPrivacy'), b = a.getBoundingClientRect(); return { h: b.height, href: a.getAttribute('href'), credit: document.getElementById('howCredit').textContent, items: document.querySelectorAll('#howList li').length, svgs: document.querySelectorAll('#howList svg').length } })
  expect(r.h >= 38 && r.href === 'privacy.html' && /CC BY/.test(r.credit) && r.items === 4 && r.svgs === 8, JSON.stringify(r))
})
await m.close()
// ---- 3サイズ × 全画面で一画面
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]) {
  const v = await open(browser, { viewport: { width: w, height: h } })
  const { views, tx, tx2, ts } = await visit(v, name)
  for (const [k, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${k}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: 遊び中の文字が画面内・2つまで（印の時と答え合わせの時）`, async () => { expect(tx.n <= 2 && !tx.out.length && tx2.n <= 2 && tx2.n >= 1 && !tx2.out.length, JSON.stringify({ tx, tx2 })) })
  await t(`${name}: 印の書き文字が画面幅の4割以上・時計が画面内`, async () => { expect(ts.ono && ts.ono.w >= ts.W * 0.4 && ts.clock.x < ts.W - 10, JSON.stringify(ts)); return { w: ts.ono.w, W: ts.W } })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(v); expect(o.sw <= o.W && !o.bad.length && !v.errs.length, JSON.stringify(o) + v.errs.join('|')) })
  await v.close()
}
await t('Chromium: 実際には無音（__muteOk）', async () => { const v = await open(browser); await v.click('#bStart'); await v.waitForTimeout(500); const r = await v.evaluate(() => window.__muteOk()); expect(r, r); await v.close() })
await browser.close()
// ---- WebKit（iPhone 相当）
const wb = await webkit.launch()
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]) {
  const wp = await open(wb, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const { views } = await visit(wp, 'wk-' + name, true)
  for (const [k, r] of Object.entries(views)) await t(`WebKit 一画面 ${name} ${k}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`WebKit ${name}: エラーなし`, async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
  await wp.close()
}
const wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで遊べる（印が出たら返事を指で押す）', async () => {
  await press(wp, '#bStart', true); await wp.evaluate(() => { okan.dbg.pause(); okan.dbg.force(['knock']) }); await toTell(wp, 0.6)
  await press(wp, '#dReply', true); const r = await wp.evaluate(() => okan.state.def); expect(r === 'reply', r)
})
await t('WebKit: 実際には無音（タップで始めたあと）', async () => { const r = await wp.evaluate(() => window.__muteOk()); expect(r, r) })
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
