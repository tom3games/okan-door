// sim 用の bot。ゲームの中で毎フレーム呼ばれ、見えている手がかり（okan.tells）だけを読む
// 人間の速さ: 決め手が出てから 2.0 秒で選ぶ。連打は 1 秒に 6 回
window.BOTS = {
  // 手口を読む
  reader(api, st) {
    const o = api.tells(); if (!o) return
    if (o.phase === 'push') { st.tapT = (st.tapT || 0) + 1 / 60; if (st.tapT >= 1 / 6) { st.tapT = 0; api.tap() } return }
    if (o.phase !== 'approach') { st.done = false; return }
    if (st.done || o.t < 2.4 + 2.0) return
    let d = 'reply'
    if (o.window) d = 'hide'
    else if (o.knob === 'key' || o.shadow === 'low') d = 'hide'
    else if (o.knob === 'rattle' || o.steps === 'heavy') d = 'hold'
    else if (o.shadow === 'aside') d = api.state.streak >= 2 ? 'hide' : 'sleep'
    else if (o.knob === 'slow' || o.steps === 'tiptoe') d = api.state.streak >= 2 ? 'hold' : 'sleep'
    // 枕のアイコンが赤い（寝たふり2回続けた）ときは、しのぐ方を選ぶ
    api.choose(d); st.done = true
  },
  hold(api, st) { const o = api.tells(); if (!o) return; if (o.phase === 'push') { st.tapT = (st.tapT || 0) + 1 / 60; if (st.tapT >= 1 / 6) { st.tapT = 0; api.tap() } return } if (o.phase === 'approach' && !api.state.def && o.t > 1) api.choose('hold') },
  sleep(api) { const o = api.tells(); if (o && o.phase === 'approach' && !api.state.def && o.t > 1) api.choose('sleep') },
  reply(api) { const o = api.tells(); if (o && o.phase === 'approach' && !api.state.def && o.t > 1) api.choose('reply') },
  hide(api) { const o = api.tells(); if (o && o.phase === 'approach' && !api.state.def && o.t > 1) api.choose('hide') },
  none() {},
  random(api, st) {
    const o = api.tells(); if (!o) return
    if (o.phase === 'push') { st.tapT = (st.tapT || 0) + 1 / 60; if (st.tapT >= 1 / 6) { st.tapT = 0; api.tap() } return }
    if (o.phase !== 'approach') { st.at = null; return }
    if (st.at == null) st.at = 1 + st.r() * (o.deadline - 1.2)
    if (!api.state.def && o.t >= st.at) api.choose(['hold', 'sleep', 'reply', 'hide'][Math.floor(st.r() * 4)])
  },
}
