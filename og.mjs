// SNS用サムネ og.png（1200x630）。node og.mjs
// 左: 「ご飯できたよー」なのにノブがガチャガチャ（ドアに寄った場面）。右: ドアに貼った紙のタイトル
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const ROOT = import.meta.dirname
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '5905' } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, locale: 'ja-JP' }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto('http://localhost:5905/?notut=1'); await p.waitForFunction(() => window.__okanReady)
await p.evaluate(() => document.fonts.ready)
await p.waitForTimeout(800)
await p.evaluate(() => {
  okan.dbg.pause(); document.getElementById('bStart').click(); okan.dbg.pause()
  okan.dbg.CAMZ.p.set(-0.05, 1.5, 1.35); okan.dbg.CAMZ.t.set(-0.5, 0.95, -2.0)
  okan.dbg.force(['vacuum'], 6, { line: ['ご飯できたよー', "Dinner's ready!"] })
  let k = 0; while (!(okan.state.phase === 'tell' && okan.state.t > 0.95) && k++ < 900) okan.dbg.step(1)
  okan.dbg.ono.scale.set(0.9, 0.34, 1); okan.dbg.ono.position.set(-0.86, 1.24, -1.75); okan.dbg.ono.material.rotation = -0.06
  okan.dbg.render()
})
await p.addStyleTag({ content: `#defs,#bMute,#hint{display:none!important}#view{transform:translateX(-250px)}#bubble{margin-left:-250px;font-size:34px;padding:12px 20px}
  body::after{content:'';position:fixed;inset:0 0 0 50%;background:linear-gradient(90deg,rgba(29,25,21,0),rgba(29,25,21,.9) 22%);z-index:30}` })
await p.evaluate(() => {
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:44px;top:0;bottom:0;width:520px;z-index:31;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:26px'
  d.innerHTML = `<div style="position:relative;background:#fbf6ea;padding:30px 34px 24px;transform:rotate(-2.4deg);box-shadow:0 12px 30px rgba(0,0,0,.45);background-image:repeating-linear-gradient(transparent 0 43px,rgba(90,120,170,.22) 43px 44px)">
    <i style="position:absolute;width:96px;height:28px;background:rgba(240,226,180,.85);top:-12px;left:-18px;transform:rotate(-24deg)"></i><i style="position:absolute;width:96px;height:28px;background:rgba(240,226,180,.85);top:-12px;right:-20px;transform:rotate(18deg)"></i>
    <div style="font-family:'Yusei Magic';font-size:52px;line-height:1.1;color:#1c1712">おかんを</div>
    <div style="font-family:'Yusei Magic';font-size:76px;line-height:1.1;color:#c4372b;white-space:nowrap">部屋に入れるな</div></div>
  <div style="font-family:'Klee One';font-weight:600;font-size:28px;line-height:1.5;color:#f2e6cf;text-align:center">「ご飯できたよー」なのに<br>ノブがガチャガチャ。<br>台詞よりドアを見て守れ。</div>`
  document.body.appendChild(d)
})
await p.waitForTimeout(500)
await p.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
console.log('ok')
