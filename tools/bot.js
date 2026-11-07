// sim 用の bot。ゲームの中で毎フレーム呼ばれ、見えている手がかり（okan.tells）だけを読む
// 人間の速さ: 印が出てから 1.0〜1.4 秒で選ぶ。連打は 1 秒に 6 回
window.BOTS = (function () {
  const MAP = { rattle: 'hold', peek: 'sleep', knock: 'reply', key: 'hide', granny: 'reply' }
  const mash = (api, st) => { st.tapT = (st.tapT || 0) + 1 / 60; if (st.tapT >= 1 / 6) { st.tapT = 0; api.tap() } }
  // 印を読む。use: 'vis'（絵だけ＝音を消して遊ぶ人）/ 'snd'（音だけ）/ 'any'
  const reader = use => (api, st) => {
    const o = api.tells(); if (!o) return
    if (o.phase === 'push') return mash(api, st)
    if (o.phase !== 'tell') { st.at = null; return }
    if (st.at == null) st.at = 1.0 + st.r() * 0.4
    if (o.def || o.t < st.at) return
    const cue = use === 'vis' ? o.vis : use === 'snd' ? o.snd : (o.vis || o.snd)
    if (cue) api.choose(MAP[cue])
  }
  // 台詞だけを信じる（印を見ない）
  const LINE = [['掃除', 'hold'], ['ホコリ', 'hold'], ['父さん', 'hold'], ['鍵', 'hide'], ['宅配', 'hide'], ['寝て', 'sleep'], ['洗濯', 'sleep'], ['猫', 'sleep']]
  const always = d => (api, st) => { const o = api.tells(); if (!o) return; if (o.phase === 'push') return mash(api, st); if (o.phase === 'tell' && !o.def && o.t > 0.5) api.choose(d) }
  return {
    reader: reader('any'),
    muted: reader('vis'),
    line(api, st) {
      const o = api.tells(); if (!o) return
      if (o.phase === 'push') return mash(api, st)
      if (o.phase !== 'tell' || o.def || o.t < 1.0) return
      const l = o.line || ''; let d = 'reply'; for (const [w, dd] of LINE) if (l.includes(w)) { d = dd; break }
      api.choose(d)
    },
    hold: always('hold'), sleep: always('sleep'), reply: always('reply'), hide: always('hide'),
    none() {},
    random(api, st) {
      const o = api.tells(); if (!o) return
      if (o.phase === 'push') return mash(api, st)
      if (o.phase !== 'tell') { st.at = null; return }
      if (st.at == null) st.at = 0.3 + st.r() * Math.max(0.2, Math.min(o.win, 4) - 0.6)
      if (!o.def && o.t >= st.at) api.choose(['hold', 'sleep', 'reply', 'hide'][Math.floor(st.r() * 4)])
    },
  }
})()
