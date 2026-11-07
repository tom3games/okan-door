// おかんを部屋に入れるな。本体
// 遊びの流れ: 朝7時から夜10時までに11回、おかんが来る。足音・ドアの下の影・ドアノブで手口を読み、4つの守り方から選ぶ
// 仕様の正本は ~/Desktop/claudecode/ideas/okan-door.md。文言と判定表は data.js
import * as THREE from 'three'
import { setupLook, surfaceTex, addCornerAO, addBlobShadow, look, createFx } from './look.js?v=1'
window.__jsUp = true
const OD = window.OD
const $ = id => document.getElementById(id)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, k) => a + (b - a) * k
const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k)
const store = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } }
let lang = store.get('okan_lang') || ((navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en')
const L = p => p ? p[lang === 'en' ? 1 : 0] : ''
const T = k => L(OD.T[k])
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

// ============================================================ 音
const S = n => 'snd/' + n + '.mp3'
Snd.def({
  knock: [S('knock_a'), S('knock_b'), S('knock_c')], step: [S('step1'), S('step2'), S('step3'), S('step4')], heavy: [S('heavy1'), S('heavy2'), S('heavy3')],
  dish: [S('dish1'), S('dish2')], cloth: [S('cloth1'), S('cloth2'), S('cloth3')], creak: [S('creak1'), S('creak2'), S('creak3')],
  rattle: [S('rattle1'), S('rattle2'), S('rattle3'), S('rattle4')], dopen: [S('dopen1'), S('dopen2')], dclose: [S('dclose1'), S('dclose2')], slam: S('slam'),
  key: [S('key1'), S('key2')], unlock: S('unlock'), jingle: S('jingle'), clank: [S('clank1'), S('clank2'), S('clank3')], meow: [S('meow1'), S('meow2'), S('meow3')],
  grunt: [S('grunt1'), S('grunt2'), S('grunt3')], ring: S('ringback'), snore: S('snore'), j_win: S('j_win'), j_lose: S('j_lose'), j_end: S('j_end'), j_ok: S('j_ok'),
  click: S('click'), page: S('page'), rooster: S('rooster'),
})
let muted = store.get('okan_mute') === '1'
Snd.setMute(muted)
function loopVol(slot, v, sec = 0.4) { const l = Snd.loops[slot]; if (!l || !l.g || !Snd.ctx) return; const t = Snd.ctx.currentTime; l.g.gain.cancelScheduledValues(t); l.g.gain.setValueAtTime(l.g.gain.value, t); l.g.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + sec) }
function sfx(name, o) { if (!SIM) Snd.play(name, o) }

// ============================================================ 3D
const canvas = $('view')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1))
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 40)
const lights = setupLook(renderer, scene, { exposure: 1.05, sun: 1.4, sunPos: [3, 3.2, 0.6], target: [0, 0.6, -1], hemi: 0.75, fill: 0.35 })
const fx = createFx(scene, camera, renderer)
const R = { x0: -1.35, x1: 1.35, z0: -2.0, z1: 3.0, h: 2.4 }
const DOOR = { hx: -1.18, w: 0.78, h: 1.97, cx: -0.79 }
const texLoader = new THREE.TextureLoader()
const TEX = {}
function tex(name) {
  if (TEX[name]) return TEX[name]
  const t = texLoader.load('img/' + name + '.webp', tt => { tt.userData.ok = true; for (const m of PAPERS) if (m.userData.tex === name) fitPaper(m) })
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TEX[name] = t; return t
}
const PAPERS = []
// 切り絵の人物（足元が原点。高さ h で縦横比は画像から）
function paper(name, h) {
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0)
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex(name), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, toneMapped: false }))
  m.userData = { tex: name, h, flip: false }; PAPERS.push(m); fitPaper(m); return m
}
function fitPaper(m) { const t = TEX[m.userData.tex], img = t && t.image; const a = img && img.width ? img.width / img.height : 0.6; m.scale.set(m.userData.h * a * (m.userData.flip ? -1 : 1), m.userData.h, 1) }
function setPaper(m, name, h) { if (h) m.userData.h = h; m.userData.tex = name; m.material.map = tex(name); m.material.needsUpdate = true; fitPaper(m) }

// ---- 部屋
const wood = surfaceTex({ w: 512, h: 512, base: '#93673f', repeat: [2.2, 3], grime: 0.06, noise: 0.06, draw(x, w, h, r) { for (let i = 0; i < 8; i++) { x.fillStyle = `hsl(27,${36 + r() * 10}%,${36 + r() * 7}%)`; x.fillRect(i * w / 8, 0, w / 8, h); x.fillStyle = 'rgba(60,35,15,.55)'; x.fillRect(i * w / 8, 0, 2, h); const y = r() * h; x.fillRect(i * w / 8, y, w / 8, 2) } } })
const paperWall = surfaceTex({ w: 256, h: 256, base: '#e9e0cd', repeat: [3, 2], grime: 0.05, noise: 0.03, draw(x, w, h) { x.fillStyle = 'rgba(160,140,100,.12)'; for (let i = 0; i < w; i += 16) x.fillRect(i, 0, 3, h) } })
const matWall = new THREE.MeshStandardMaterial({ map: paperWall, roughness: 0.95 })
function plane(w, h, mat, pos, rot) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); scene.add(m); return m }
function box(w, h, d, mat, pos, parent = scene) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(...pos); parent.add(m); return m }
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.85, metalness: o.m ?? 0, ...(o.e ? { emissive: o.e, emissiveIntensity: o.ei ?? 1 } : {}), ...(o.map ? { map: o.map } : {}) })
plane(R.x1 - R.x0, R.z1 - R.z0, new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7 }), [0, 0, (R.z0 + R.z1) / 2], [-Math.PI / 2, 0, 0])
plane(R.x1 - R.x0, R.z1 - R.z0, std('#efe9de'), [0, R.h, (R.z0 + R.z1) / 2], [Math.PI / 2, 0, 0])
plane(R.z1 - R.z0, R.h, matWall, [R.x0, R.h / 2, (R.z0 + R.z1) / 2], [0, Math.PI / 2, 0])
plane(R.z1 - R.z0, R.h, matWall, [R.x1, R.h / 2, (R.z0 + R.z1) / 2], [0, -Math.PI / 2, 0])
// ドアの壁（ドアの穴を空けて3枚）
plane(DOOR.hx - R.x0, R.h, matWall, [(R.x0 + DOOR.hx) / 2, R.h / 2, R.z0])
plane(R.x1 - (DOOR.hx + DOOR.w), R.h, matWall, [(DOOR.hx + DOOR.w + R.x1) / 2, R.h / 2, R.z0])
plane(DOOR.w, R.h - DOOR.h - 0.02, matWall, [DOOR.cx, (R.h + DOOR.h + 0.02) / 2, R.z0])
// 巾木と枠
const trim = std('#f4efe4', { r: 0.6 })
for (const [x, w] of [[(R.x0 + DOOR.hx) / 2, DOOR.hx - R.x0], [(DOOR.hx + DOOR.w + R.x1) / 2, R.x1 - DOOR.hx - DOOR.w]]) box(w, 0.07, 0.02, trim, [x, 0.035, R.z0 + 0.01])
box(0.05, DOOR.h + 0.05, 0.05, trim, [DOOR.hx - 0.025, (DOOR.h + 0.05) / 2, R.z0 + 0.012]); box(0.05, DOOR.h + 0.05, 0.05, trim, [DOOR.hx + DOOR.w + 0.025, (DOOR.h + 0.05) / 2, R.z0 + 0.012]); box(DOOR.w + 0.1, 0.05, 0.05, trim, [DOOR.cx, DOOR.h + 0.025, R.z0 + 0.012])
addCornerAO(scene, { minX: R.x0, maxX: R.x1, minZ: R.z0, maxZ: R.z1, strength: 0.32, sides: 'LRB' })
// 廊下（ドアの向こう。いつも明かりがついている）
const hall = new THREE.Group(); scene.add(hall)
const hallMat = std('#f3dcae', { e: '#c98f3f', ei: 0.35 })
box(2.2, 0.02, 1.6, std('#a87a4c', { e: '#4a2c10', ei: 0.3 }), [-0.9, -0.01, -2.85], hall)
box(2.2, R.h, 0.05, hallMat, [-0.9, R.h / 2, -3.6], hall)
box(0.05, R.h, 1.6, hallMat, [-1.95, R.h / 2, -2.8], hall); box(0.05, R.h, 1.6, hallMat, [0.15, R.h / 2, -2.8], hall)
const hallLight = new THREE.PointLight('#ffd08a', 2.2, 4, 1.4); hallLight.position.set(-0.9, 2.1, -2.8); hall.add(hallLight)
// ドア（ちょうつがいを軸に部屋側へ開く）
const doorPivot = new THREE.Group(); doorPivot.position.set(DOOR.hx, 0, R.z0); scene.add(doorPivot)
const doorTex = surfaceTex({ w: 256, h: 512, base: '#9b7048', grime: 0.08, noise: 0.05, draw(x, w, h) { x.strokeStyle = 'rgba(50,30,12,.6)'; x.lineWidth = 6; x.strokeRect(28, 34, w - 56, h * 0.38); x.strokeRect(28, h * 0.5, w - 56, h * 0.42); x.fillStyle = 'rgba(255,240,210,.08)'; x.fillRect(34, 40, w - 68, 10) } })
const doorMesh = box(DOOR.w, DOOR.h, 0.04, new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.6 }), [DOOR.w / 2, DOOR.h / 2 + 0.03, 0], doorPivot)
const lever = new THREE.Group(); lever.position.set(DOOR.w - 0.1, 0.95, 0.03); lever.scale.setScalar(1.6); doorPivot.add(lever)
const brass = std('#caa04a', { r: 0.3, m: 0.85 })
const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20), brass); rose.rotation.x = Math.PI / 2; lever.add(rose)
const bar = box(0.13, 0.025, 0.025, brass, [-0.06, 0, 0.03], lever)
const keyhole = box(0.012, 0.026, 0.01, std('#20160c'), [0, -0.07, 0.006], lever)
const glint = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#fff6c8', transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); glint.scale.set(0.06, 0.06, 1); glint.position.set(0, -0.07, 0.03); lever.add(glint)
const notes = new THREE.Group(); doorPivot.add(notes)
// ドアに貼った紙「ノックしてね」
{ const c = document.createElement('canvas'); c.width = 256; c.height = 180; const x = c.getContext('2d'); x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, 256, 180); x.fillStyle = 'rgba(240,226,180,.9)'; x.fillRect(90, 0, 76, 18); x.fillStyle = '#1c1712'; x.font = '44px "Yusei Magic", sans-serif'; x.textAlign = 'center'; x.fillText(lang === 'en' ? 'KNOCK' : 'ノック', 128, 82); x.fillText(lang === 'en' ? 'FIRST' : 'してね', 128, 140)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = plane(0.3, 0.21, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), [0, 0, 0]); m.removeFromParent(); m.position.set(DOOR.w / 2, 1.5, 0.025); m.rotation.z = 0.04; doorPivot.add(m); m.userData.c = c; m.userData.t = t; window.__doorSign = m }
// ドアの下のすき間の光と、床に落ちる光（ここに足の影が出る）
const gapLine = plane(DOOR.w - 0.02, 0.028, new THREE.MeshBasicMaterial({ color: '#ffd98a', toneMapped: false }), [DOOR.cx, 0.016, R.z0 + 0.005])
const spillC = document.createElement('canvas'); spillC.width = 256; spillC.height = 192
const spillT = new THREE.CanvasTexture(spillC); spillT.colorSpace = THREE.SRGBColorSpace
const spill = plane(1.4, 1.7, new THREE.MeshBasicMaterial({ map: spillT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [DOOR.cx, 0.006, R.z0 + 0.85], [-Math.PI / 2, 0, 0])
// 足の影（光の上に暗く重ねる。昼でも読めるように）
const shadC = document.createElement('canvas'); shadC.width = 256; shadC.height = 192
const shadT = new THREE.CanvasTexture(shadC)
const shad = plane(1.4, 1.7, new THREE.MeshBasicMaterial({ map: shadT, transparent: true, depthWrite: false, toneMapped: false }), [DOOR.cx, 0.009, R.z0 + 0.85], [-Math.PI / 2, 0, 0])
// テレビ台とゲーム画面
const tvC = document.createElement('canvas'); tvC.width = 192; tvC.height = 112; const tvT = new THREE.CanvasTexture(tvC); tvT.colorSpace = THREE.SRGBColorSpace
box(0.5, 0.36, 0.34, std('#5b4a3a'), [-0.06, 0.18, R.z0 + 0.19])
box(0.5, 0.32, 0.04, std('#1b1b1e', { r: 0.4 }), [-0.06, 0.53, R.z0 + 0.16])
const tvScreen = plane(0.45, 0.27, new THREE.MeshBasicMaterial({ map: tvT, toneMapped: false }), [-0.06, 0.53, R.z0 + 0.185])
const tvGlow = new THREE.PointLight('#8fb6ff', 0.6, 2.2, 2); tvGlow.position.set(-0.06, 0.55, R.z0 + 0.5); scene.add(tvGlow)
// ベッド（ドアの右、壁ぞい。下にもぐれる高さ）
const bed = new THREE.Group(); scene.add(bed)
const BX = 0.83
box(1.05, 0.14, 0.95, std('#6e4f33'), [BX, 0.22, R.z0 + 0.5], bed)
for (const [x, z] of [[0.33, R.z0 + 0.07], [1.32, R.z0 + 0.07], [0.33, R.z0 + 0.93], [1.32, R.z0 + 0.93]]) box(0.05, 0.16, 0.05, std('#4e3622'), [x, 0.08, z], bed)
box(1.02, 0.12, 0.92, std('#f2eee6'), [BX, 0.35, R.z0 + 0.5], bed)
const blanket = box(0.76, 0.06, 1.0, std('#7da0c9', { r: 0.95 }), [BX + 0.13, 0.43, R.z0 + 0.5], bed)
box(0.76, 0.24, 0.02, std('#6f92bb', { r: 0.95 }), [BX + 0.13, 0.3, R.z0 + 1.0], bed)
box(0.24, 0.1, 0.55, std('#ffffff'), [0.45, 0.46, R.z0 + 0.5], bed)
plane(1.0, 0.13, new THREE.MeshBasicMaterial({ color: '#0d0905' }), [BX, 0.08, R.z0 + 0.6])
// 本棚・ポスター・ラグ・照明
const shelf = new THREE.Group(); scene.add(shelf)
box(0.32, 1.5, 0.9, std('#7a5838'), [R.x0 + 0.16, 0.75, -0.75], shelf)
{ const r = mulberry(11); for (let s = 0; s < 4; s++) { let z = -1.15; while (z < -0.4) { const w = 0.04 + r() * 0.05; box(0.22, 0.24 + r() * 0.08, w, std(`hsl(${Math.floor(r() * 360)},${30 + r() * 30}%,${35 + r() * 25}%)`), [R.x0 + 0.2, 0.18 + s * 0.36, z + w / 2], shelf); z += w + 0.006 } } }
function posterTex(seed, hue) { const c = document.createElement('canvas'); c.width = 160; c.height = 220; const x = c.getContext('2d'), r = mulberry(seed); x.fillStyle = `hsl(${hue},45%,30%)`; x.fillRect(0, 0, 160, 220); for (let i = 0; i < 5; i++) { x.fillStyle = `hsl(${(hue + 40 + r() * 160) % 360},70%,${50 + r() * 20}%)`; x.beginPath(); x.arc(r() * 160, r() * 220, 20 + r() * 40, 0, 7); x.fill() } x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(20, 168, 120, 8); x.fillRect(20, 184, 80, 6); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
plane(0.42, 0.58, new THREE.MeshStandardMaterial({ map: posterTex(3, 220) }), [R.x0 + 0.01, 1.6, 0.55], [0, Math.PI / 2, -0.03])
plane(0.36, 0.5, new THREE.MeshStandardMaterial({ map: posterTex(8, 330) }), [R.x0 + 0.01, 1.55, -0.2], [0, Math.PI / 2, 0.05])
const rugTex = surfaceTex({ w: 256, h: 256, base: '#b4553f', grime: 0.05, noise: 0.08, draw(x, w, h) { x.strokeStyle = '#e8c9a0'; x.lineWidth = 8; x.strokeRect(14, 14, w - 28, h - 28); x.lineWidth = 3; x.strokeRect(30, 30, w - 60, h - 60) } })
plane(1.5, 1.1, new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }), [0, 0.004, 0.0], [-Math.PI / 2, 0, 0.04])
const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 24), new THREE.MeshStandardMaterial({ color: '#fff8e8', emissive: '#fff1cc', emissiveIntensity: 0.2 })); lamp.position.set(0.1, R.h - 0.03, -0.7); scene.add(lamp)
const lampLight = new THREE.PointLight('#ffe8c2', 0, 7, 1.2); lampLight.position.set(0, R.h - 0.2, 0.3); scene.add(lampLight)
// 時計（ドアの上）
const clockC = document.createElement('canvas'); clockC.width = clockC.height = 256; const clockT = new THREE.CanvasTexture(clockC); clockT.colorSpace = THREE.SRGBColorSpace
const clockM = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), new THREE.MeshStandardMaterial({ map: clockT, roughness: 0.5 })); clockM.position.set(-0.06, 1.38, R.z0 + 0.015); scene.add(clockM)
const clockRim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 10, 40), std('#2c2c30', { r: 0.4 })); clockRim.position.copy(clockM.position); scene.add(clockRim)
let clockMin = -1
function drawClock(hour) {
  const m = Math.floor(hour * 60); if (m === clockMin) return; clockMin = m
  const x = clockC.getContext('2d'); x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, 256, 256); x.save(); x.translate(128, 128)
  for (let i = 0; i < 12; i++) { x.save(); x.rotate(i * Math.PI / 6); x.fillStyle = '#222'; x.fillRect(-4, -118, 8, i % 3 ? 14 : 26); x.restore() }
  const hh = (hour % 12) / 12 * Math.PI * 2, mm = (hour % 1) * Math.PI * 2
  x.lineCap = 'round'; x.strokeStyle = '#1a1a1a'; x.lineWidth = 12; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.sin(hh) * 62, -Math.cos(hh) * 62); x.stroke()
  x.lineWidth = 7; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.sin(mm) * 96, -Math.cos(mm) * 96); x.stroke(); x.fillStyle = '#c4372b'; x.beginPath(); x.arc(0, 0, 9, 0, 7); x.fill(); x.restore(); clockT.needsUpdate = true
}
// 窓（右の壁）。外の景色はキャンバスに描く。はしごのおかんもここに描く
const winC = document.createElement('canvas'); winC.width = 256; winC.height = 256; const winT = new THREE.CanvasTexture(winC); winT.colorSpace = THREE.SRGBColorSpace
const winX = 0.86, winY = 1.42, winW = 0.78, winH = 0.66
plane(winW, winH, new THREE.MeshBasicMaterial({ map: winT, toneMapped: false }), [winX, winY, R.z0 + 0.005])
for (const [w, h, x, y] of [[0.05, winH + 0.05, winX - winW / 2, winY], [0.05, winH + 0.05, winX + winW / 2, winY], [0.03, winH, winX, winY], [winW + 0.05, 0.05, winX, winY + winH / 2], [winW + 0.12, 0.06, winX, winY - winH / 2]]) box(w, h, 0.05, trim, [x, y, R.z0 + 0.02])
const curtainMat = std('#d9c27a', { r: 1 })
box(0.2, 0.95, 0.03, curtainMat, [winX - winW / 2 - 0.08, winY - 0.05, R.z0 + 0.06]); box(0.2, 0.95, 0.03, curtainMat, [winX + winW / 2 + 0.05, winY - 0.05, R.z0 + 0.06])
const winLight = new THREE.PointLight('#ffffff', 0.8, 5, 1.5); winLight.position.set(winX, winY, R.z0 + 0.6); scene.add(winLight)
let ladderK = 0, ladderShow = 0
function sky(h) {
  const keys = [[6.5, '#bcd2ec', '#f7e3c8'], [9, '#9cc8f0', '#e8f2fb'], [15, '#86b8e8', '#dceaf6'], [17.2, '#e9a26a', '#f6d29a'], [18.6, '#53507e', '#c47c6a'], [20, '#1d2445', '#3b3f6a'], [23, '#10142a', '#1d2445']]
  let i = 0; while (i < keys.length - 2 && h > keys[i + 1][0]) i++
  const a = keys[i], b = keys[i + 1], k = clamp((h - a[0]) / (b[0] - a[0]), 0, 1)
  return [new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), k), new THREE.Color(a[2]).lerp(new THREE.Color(b[2]), k)]
}
let lastWin = ''
function drawWindow(h) {
  const key = Math.round(h * 20) + ':' + ladderK.toFixed(2) + ':' + ladderShow
  if (key === lastWin) return; lastWin = key
  const x = winC.getContext('2d'), [top, bot] = sky(h)
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#' + top.getHexString()); g.addColorStop(1, '#' + bot.getHexString()); x.fillStyle = g; x.fillRect(0, 0, 256, 256)
  if (h > 19) { x.fillStyle = '#fff8dc'; x.beginPath(); x.arc(190, 52, 16, 0, 7); x.fill() }
  x.fillStyle = h > 18.5 ? '#141422' : '#5a6474'
  for (const [x0, w, hh] of [[0, 70, 90], [64, 60, 120], [118, 80, 70], [190, 70, 105]]) { x.fillRect(x0, 256 - hh, w, hh); x.beginPath(); x.moveTo(x0 - 8, 256 - hh); x.lineTo(x0 + w / 2, 256 - hh - 26); x.lineTo(x0 + w + 8, 256 - hh); x.fill() }
  if (h > 18.5) { x.fillStyle = '#ffd98a'; for (const [a, b] of [[20, 200], [90, 160], [140, 210], [210, 180]]) x.fillRect(a, b, 12, 10) }
  if (ladderShow) {
    x.strokeStyle = '#c9ced6'; x.lineWidth = 9; const ly = 256 - ladderK * 120
    x.beginPath(); x.moveTo(70, 270); x.lineTo(80, ly); x.moveTo(186, 270); x.lineTo(176, ly); x.stroke(); x.lineWidth = 7; for (let y = ly + 20; y < 260; y += 34) { x.beginPath(); x.moveTo(78, y); x.lineTo(178, y); x.stroke() }
    const img = TEX.m_ladder && TEX.m_ladder.image
    if (img && img.width && ladderK > 0.35) { const s = 220 / img.height, w = img.width * s, k = ease((ladderK - 0.35) / 0.65); x.drawImage(img, 128 - w / 2, 256 - k * 170, w, 220) }
  }
  winT.needsUpdate = true
}

// ---- 人物
const hero = paper('h_idle', 1.5); scene.add(hero)
const okan = paper('m_knock', 1.5); okan.visible = false; scene.add(okan)
const okan2 = paper('dad', 1.55); okan2.visible = false; scene.add(okan2)
const cat = paper('cat', 0.5); cat.visible = false; scene.add(cat)
addBlobShadow(hero, 0.55, { opacity: 0.35 }); addBlobShadow(okan, 0.6, { opacity: 0.3 })
const HERO_AT = {
  idle: { pose: 'h_idle', p: [0.02, 0, 0.2], h: 1.34 },
  hold: { pose: 'h_hold', p: [-0.82, 0, -1.6], h: 1.32 },
  reply: { pose: 'h_shout', p: [0.02, 0, 0.2], h: 1.34, flip: true },
  sleep: { pose: 'h_sleep', p: [0.86, 0.36, R.z0 + 0.62], h: 0.42 },
  hide: { pose: 'h_hide', p: [0.84, 0.0, R.z0 + 0.86], h: 0.26 },
  tired: { pose: 'h_tired', p: [-0.82, 0, -1.5], h: 1.42 },
  busted: { pose: 'h_busted', p: [0.02, 0, 0.2], h: 1.38 },
}
let heroState = 'idle'
function setHero(st, at) {
  const d = HERO_AT[st]; heroState = st; hero.userData.flip = !!d.flip; setPaper(hero, d.pose, d.h)
  const p = at ? at : d.p; hero.position.set(...p); hero.userData.base = p
}

// ---- カメラ
function frame() {
  const w = innerWidth, h = innerHeight, a = w / h
  renderer.setSize(w, h, false); camera.aspect = a
  const half = 1.42, dist = 4.3
  const hf = 2 * Math.atan(half / dist), vf = 2 * Math.atan(Math.tan(hf / 2) / a)
  camera.fov = clamp(vf * 180 / Math.PI, 48, 84); camera.updateProjectionMatrix()
}
const CAM = { p: new THREE.Vector3(0.02, 1.78, 2.6), t: new THREE.Vector3(-0.06, 0.66, -1.5) }
addEventListener('resize', frame); frame()

// ============================================================ 遊びの状態
const params = new URLSearchParams(location.search)
let SIM = false
const G = {
  mode: 'boot', day: null, i: 0, a: null, F: 0, streak: 0, score: 0, perfect: 0, ok: 0, breach: 0, granny: 0, log: [], hour: 6.8, tutStep: -1, paused: false, endT: 0, seed: 0, texts: { bubble: null, hbubble: null, stamp: null, hint: null },
}
const N_SLOTS = 11
function makeDay(seed) {
  const r = mulberry(seed), pick = a => a[Math.floor(r() * a.length)]
  let ints
  for (let tries = 0; tries < 200; tries++) {
    ints = ['CALL', 'CALL', 'PEEK', 'PEEK', 'RUSH', 'RUSH', 'LURE', 'LURE', 'KEY', pick(['CALL', 'PEEK', 'RUSH', 'LURE'])]
    for (let i = ints.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ints[i], ints[j]] = [ints[j], ints[i]] }
    ints.unshift('CALL')
    let ok = true; for (let i = 2; i < ints.length; i++) if (ints[i] === ints[i - 1] && ints[i] === ints[i - 2]) ok = false
    if (ints.indexOf('KEY') < 3) ok = false
    if (ok) break
  }
  if (r() < 0.35) { const c = [6, 7, 8, 9, 10].filter(i => ints[i] !== 'KEY'); ints[pick(c)] = 'LADDER' }
  if (r() < 0.25) { const c = [4, 5, 6, 7, 8, 9].filter(i => ints[i] !== 'KEY' && ints[i] !== 'LADDER'); ints[pick(c)] = 'GRANNY' }
  const used = {}, slots = []
  ints.forEach((intent, i) => {
    let id
    if (intent === 'CALL') id = pick(['knock', 'gohan_call', 'laundry_call', 'teacher'].filter(k => !used[k]).concat(i === 0 ? [] : []).filter(Boolean)) || 'knock'
    else if (intent === 'PEEK') id = pick(['gohan_peek', 'laundry_peek', 'knock_peek', 'cat'].filter(k => !used[k])) || 'knock_peek'
    else if (intent === 'RUSH') id = i < 4 ? 'vacuum' : pick(['vacuum', 'dad', ...(i >= 5 ? ['vacuum_lie'] : [])].filter(k => !used[k] || k === 'vacuum'))
    else if (intent === 'LURE') id = 'lure'
    else id = { KEY: 'key', LADDER: 'ladder', GRANNY: 'granny' }[intent]
    used[id] = 1
    const tac = OD.TACTICS[id]
    const line = id === 'lure' ? OD.LURES[Math.min(4, Math.floor(i / N_SLOTS * 5))] : pick(tac.lines)
    slots.push({ id, intent, line })
  })
  return slots
}
const TUT = [{ id: 'knock', intent: 'CALL', line: OD.TACTICS.knock.lines[0], want: 'reply', hint: 'tut1' }, { id: 'vacuum', intent: 'RUSH', line: OD.TACTICS.vacuum.lines[0], want: 'hold', hint: 'tut2' }, { id: 'knock_peek', intent: 'PEEK', line: OD.TACTICS.knock_peek.lines[0], want: 'sleep', hint: 'tut3' }]
const T_STEPS = 0, T_LINE = 1.2, T_KNOB = 2.4, PUSH_DUR = 2.2
function winFor(i) { return 3.6 - 1.2 * (i / (N_SLOTS - 1)) }

function newAttempt(slot, tut) {
  const tac = OD.TACTICS[slot.id], tells = OD.TELLS[slot.intent]
  return { ...slot, tac, tells, tut: !!tut, phase: 'quiet', t: 0, quiet: G.i === 0 && !tut ? 1.1 : 1.6, def: null, deadline: T_KNOB + (tut ? 2.4 : winFor(G.i)), taps: 0, p: 0, res: null, obs: { steps: null, shadow: null, knob: null, window: false, line: null, sound: null }, sh: { x: -0.9, kind: 'none' }, nextStep: 0, door: 0, doorTo: 0, out: 0, rt: 0, events: {} }
}
function startDay() {
  G.seed = params.get('seed') ? Number(params.get('seed')) + G.playNo : Math.floor(Math.random() * 1e9)
  G.day = makeDay(G.seed); G.i = 0; G.F = 0; G.streak = 0; G.score = 0; G.perfect = 0; G.ok = 0; G.breach = 0; G.granny = 0; G.log = []
  notes.clear(); G.mode = 'play'; G.a = newAttempt(G.day[0]); G.hour = 7
  setHero('idle'); resetDoor()
  if (!SIM) { sfx('rooster', { vol: 0.5 }); if (window.TM) TM.start() }
}
G.playNo = 0
function resetDoor() { okan.visible = false; okan2.visible = false; cat.visible = false; ladderShow = 0; ladderK = 0 }

// 見えている手がかり（bot もこれだけを読む）
function tells() { return G.a ? { ...G.a.obs, t: G.a.t, phase: G.a.phase, deadline: G.a.deadline } : null }

function choose(d) {
  const a = G.a; if (!a || !(a.phase === 'approach')) return false
  if (a.tut && d !== a.want) { if (!SIM) sfx('click', { vol: 0.3 }); return false }
  a.def = d
  if (!SIM) sfx('click', { vol: 0.5 })
  setHero(d)
  if (d === 'reply' && !a.tut) say('hbubble', L(OD.REPLY), 'hero', 1.4)
  if (d === 'sleep') sfx('snore', { vol: 0.5, delay: 0.2 })
  loopVol('game', d === 'sleep' || d === 'hide' ? 0 : 0.16)
  return true
}
function tap() { const a = G.a; if (a && a.phase === 'push') { a.taps++; a.lastTap = a.t; if (!SIM && a.taps % 3 === 0) sfx('grunt', { vol: 0.35 }) ; return true } return false }

// 文字（同時に2つまで。新しいものを出す時に数をそろえる）
function say(slot, text, cls, sec) {
  if (SIM) return
  const minSec = 0.9 + 0.09 * [...text].length
  G.texts[slot] = { text, cls: cls || '', until: G.clock + Math.max(sec || 0, minSec), born: G.clock }
}
function unsay(slot) { G.texts[slot] = null }
G.clock = 0

function stepAttempt(dt) {
  const a = G.a; a.t += dt; const t = a.t
  if (a.phase === 'quiet') {
    if (t >= a.quiet) { a.phase = 'approach'; a.t = 0; a.base0 = 0 }
    return
  }
  const intent = a.intent, tl = a.tells
  if (a.phase === 'approach') {
    // 足音と影
    if (!a.events.steps && t >= T_STEPS) { a.events.steps = 1; a.obs.steps = tl.steps; a.obs.window = !!tl.window; a.sh.kind = intent === 'RUSH' ? (a.tac.dad ? 'two' : 'big') : intent === 'GRANNY' ? 'small' : intent === 'LADDER' ? 'none' : 'center'; a.obs.shadow = tl.window ? null : a.sh.kind; if (tl.window) sfx('clank', { vol: 0.7 }) }
    if (tl.steps && t < 1.15 && t >= a.nextStep) {
      const st = tl.steps, iv = st === 'heavy' ? 0.26 : st === 'tiptoe' ? 0.5 : st === 'shuffle' ? 0.42 : 0.32
      a.nextStep = t + iv
      if (st === 'heavy') sfx('heavy', { vol: 1, rate: 0.8 }); else if (st === 'tiptoe') sfx('step', { vol: 0.22, rate: 1.35, dest: 'muf' }); else if (st === 'shuffle') sfx('step', { vol: 0.35, rate: 0.75, dest: 'muf' }); else sfx('step', { vol: 0.6 })
      if (a.tac.dad) sfx('heavy', { vol: 0.8, rate: 0.7, delay: 0.12 })
    }
    if (!tl.window) a.sh.x = lerp(-0.9, 0, ease(t / 1.1))
    if (tl.window) { ladderShow = 1; ladderK = clamp(t / 2.6, 0, 1) * 0.55; if (t > 1.0 && !a.events.clank2) { a.events.clank2 = 1; sfx('clank', { vol: 0.6 }) } }
    // 台詞と2つ目の音
    if (!a.events.line && t >= T_LINE) {
      a.events.line = 1; a.obs.line = L(a.line); a.obs.sound = a.tac.snd
      say('bubble', L(a.line), a.tac.dad ? 'dad' : '', 4)
      const s = a.tac.snd
      if (s === 'knock') sfx('knock', { vol: 0.9 }); else if (s === 'dish') sfx('dish', { vol: 0.7 }); else if (s === 'cloth') sfx('cloth', { vol: 0.8 }); else if (s === 'ring') sfx('ring', { vol: 0.5 }); else if (s === 'meow') sfx('meow', { vol: 0.8 }); else if (s === 'jingle') sfx('jingle', { vol: 0.9 }); else if (s === 'clank') sfx('clank', { vol: 0.7 }); else if (s === 'grunt') sfx('grunt', { vol: 0.6 })
      if (s === 'vacuum' && !SIM) Snd.loop('vac', S('vacuum_loop'), 0.5, 0.4)
      if (a.tac.cat) { cat.visible = true; a.catT = 0 }
    }
    if (a.tac.cat && cat.visible) { a.catT += dt; const k = ease(a.catT / 1.4); cat.position.set(lerp(DOOR.cx, -0.55, k), 0, lerp(R.z0 - 0.05, -1.35, k)); cat.scale.y = cat.userData.h * lerp(0.35, 1, ease(a.catT / 0.6)) }
    // ドアノブ
    if (!a.events.knob && t >= T_KNOB) {
      a.events.knob = 1; a.obs.knob = tl.knob
      if (intent === 'LURE') a.sh.kind = 'aside'
      if (intent === 'KEY') a.sh.kind = 'low'
      a.obs.shadow = tl.window ? null : a.sh.kind
      if (tl.knob === 'slow') sfx('creak', { vol: 0.55 })
      if (tl.knob === 'key') { sfx('jingle', { vol: 0.9 }); sfx('key', { vol: 0.8, delay: 0.7 }) }
    }
    if (a.events.knob) {
      const k = t - T_KNOB
      if (tl.knob === 'rattle') { lever.rotation.z = Math.sin(t * 38) * 0.35 * Math.min(1, k * 3); doorPivot.rotation.y = -Math.abs(Math.sin(t * 19)) * 0.012; if (!SIM && Math.floor(t / 0.2) !== Math.floor((t - dt) / 0.2)) sfx('rattle', { vol: 0.75 }) }
      else if (tl.knob === 'slow') lever.rotation.z = lerp(0, 0.55, ease(k / 1.6))
      else if (tl.knob === 'key') { glint.material.opacity = Math.max(0, Math.sin(k * 6)) * 0.9 }
      if (intent === 'LURE') a.sh.x = lerp(0, 0.95, ease(k / 0.9))
      if (tl.window) ladderK = lerp(0.55, 0.85, ease(k / 1.2))
    }
    // 判定の時
    if (t >= a.deadline) {
      if (a.tut && a.def !== a.want) { a.t = a.deadline; return }   // チュートリアルは正しい守り方を選ぶまで待つ
      resolve()
    }
    return
  }
  if (a.phase === 'push') {
    a.rt += dt
    const need = a.need, k = a.tired ? 0 : 1
    a.p = (a.rt / PUSH_DUR) * 1.6 - (a.taps * k) / need
    doorPivot.rotation.y = -clamp(a.p, 0, 1) * 0.32 - Math.sin(a.rt * 30) * 0.01
    lever.rotation.z = 0.5 + Math.sin(a.rt * 30) * 0.08
    okan.visible = a.p > 0.15
    if (a.p >= 1 && a.rt > 0.25) return finish('breach', a.tac.dad ? OD.PUSH_LOSE.RUSH : OD.PUSH_LOSE[intent === 'KEY' ? 'KEY' : 'RUSH'], 'push-lose')
    if (a.rt >= PUSH_DUR) return finish(intent === 'KEY' ? 'ok' : 'perfect', a.tac.dad ? OD.DAD_WIN : OD.PUSH_WIN[intent === 'KEY' ? 'KEY' : 'RUSH'], 'push-win')
    return
  }
  if (a.phase === 'react') {
    a.rt += dt; react(a, dt)
    if (a.rt >= a.reactDur) nextAttempt()
  }
}

// 守り方を当てはめる
function resolve() {
  const a = G.a, intent = a.intent
  let d = a.def || 'none'
  a.obs.knob = a.obs.knob || a.tells.knob
  if (intent === 'GRANNY') return finish('granny', OD.GRANNY_IN, 'granny')
  // 押さえ続けると腕が限界
  const tired = d === 'hold' && G.F >= 3
  if (d === 'hold') G.F += a.tac.dad ? 2 : 1; else G.F = Math.max(0, G.F - 1)
  if (d === 'sleep') G.streak++; else G.streak = 0
  if (tired) { a.tired = true; setHero('tired'); say('hbubble', L(OD.TIRED), 'hero', 1.4); d = 'none' }
  if (d === 'sleep' && G.streak >= 3) { G.streak = 0; return finish('breach', OD.SLEEP3, 'sleep3') }
  const [kind, line] = OD.RES[intent][d]
  if (kind === 'push') {
    a.phase = 'push'; a.rt = 0; a.taps = 0; a.need = a.tac.taps || 6
    if (a.tut) a.need = 5
    setPaper(okan, a.tac.pose === 'dad' ? 'm_win' : a.tac.pose, 1.5); okan.position.set(DOOR.cx + 0.12, 0, R.z0 - 0.42)
    if (a.tac.dad) { setPaper(okan2, 'dad', 1.5); okan2.position.set(DOOR.cx - 0.3, 0, R.z0 - 0.62); okan2.visible = true }
    if (intent === 'KEY') sfx('unlock', { vol: 0.8 })
    sfx('grunt', { vol: 0.5 })
    return
  }
  finish(kind, line, d)
}
function finish(kind, line, how) {
  const a = G.a
  a.phase = 'react'; a.rt = 0; a.kind = kind; a.how = how; a.reactDur = kind === 'breach' ? 3.0 : kind === 'granny' ? 3.4 : 2.5
  if (a.tut) a.reactDur = 2.0
  const pts = kind === 'perfect' ? 3 : kind === 'ok' ? 1 : 0
  if (!a.tut) {
    G.score += pts; if (kind === 'perfect') G.perfect++; else if (kind === 'ok') G.ok++; else if (kind === 'breach') G.breach++; else if (kind === 'granny') G.granny++
    G.log.push({ id: a.id, intent: a.intent, def: a.def || 'none', kind, how })
  }
  if (!SIM) Snd.loop('vac', null)
  if (line) say('bubble', L(line), a.tac.dad && how === 'push-win' ? 'dad' : '', 2.2)
  if (!a.tut) { unsay('hbubble'); say('stamp', T(kind), kind, 1.6) }
  lever.rotation.z = 0; glint.material.opacity = 0
  // 見た目の段取り
  const intent = a.intent
  a.vis = 'none'
  if (kind === 'breach' || kind === 'granny') {
    a.vis = intent === 'LADDER' ? 'window-in' : 'door-in'
    if (!SIM) { sfx(kind === 'granny' ? 'j_ok' : 'j_lose', { vol: 0.55 }); fx.shake(0.03, 0.3) }
    if (a.vis === 'door-in') sfx('dopen', { vol: 0.8 })
    const pose = kind === 'granny' ? 'grandma' : a.tac.dad ? 'm_win' : intent === 'LURE' ? 'm_delivery' : a.tac.pose
    setPaper(okan, pose, kind === 'granny' ? 1.15 : 1.5)
    if (a.tac.dad) { setPaper(okan2, 'dad', 1.5); okan2.visible = true }
    if (kind === 'breach') {
      const at = HERO_AT[heroState === 'sleep' ? 'sleep' : heroState === 'hide' ? 'hide' : 'idle']
      setHero('busted', heroState === 'sleep' ? [0.8, 0.42, R.z0 + 0.7] : heroState === 'hide' ? [0.8, 0, R.z0 + 1.15] : at.p)
      addNote()
    }
  } else if (kind === 'perfect' || kind === 'ok') {
    if (!SIM) sfx(kind === 'perfect' ? 'j_win' : 'j_ok', { vol: 0.45 })
    if (how === 'push-win') { sfx('slam', { vol: 0.9 }); if (!SIM) fx.shake(0.02, 0.2) }
    if (intent === 'PEEK' && a.def === 'sleep') { a.vis = 'peek'; setPaper(okan, 'm_peek', 1.5) }
    if (intent === 'KEY' && a.def === 'hide') { a.vis = 'key-look'; setPaper(okan, 'm_key', 1.5); sfx('unlock', { vol: 0.8 }); sfx('dopen', { vol: 0.7, delay: 0.3 }) }
  }
  if (how === 'push-lose') sfx('slam', { vol: 0.7 })
}
function addNote() {
  if (SIM) return
  const n = notes.children.length, c = ['#ffe36e', '#ffb3c7', '#9fe0ff'][n % 3]
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }))
  m.position.set(0.12 + (n % 4) * 0.15, 1.18 - Math.floor(n / 4) * 0.15, 0.026); m.rotation.z = (n % 2 ? 1 : -1) * 0.12; notes.add(m)
}
function react(a, dt) {
  const k = a.rt
  const inDoor = (open, inside) => {
    doorPivot.rotation.y = lerp(doorPivot.rotation.y, -open, Math.min(1, dt * 10))
    okan.visible = true
    okan.position.set(lerp(DOOR.cx + 0.05, DOOR.cx + 0.2, inside), 0, lerp(R.z0 - 0.45, -1.35, inside))
    if (okan2.visible) okan2.position.set(DOOR.cx - 0.25, 0, lerp(R.z0 - 0.6, -1.2, inside * 0.8))
  }
  if (a.vis === 'door-in') {
    const leave = a.reactDur - 0.6
    if (k < leave) inDoor(1.6, ease(k / 0.5)); else { inDoor(k < a.reactDur - 0.2 ? 1.6 : 0, 1 - ease((k - leave) / 0.4)); if (!a.events.close && k > a.reactDur - 0.2) { a.events.close = 1; sfx('dclose', { vol: 0.7 }) } }
  } else if (a.vis === 'window-in') {
    ladderShow = 1; ladderK = 1
    okan.visible = k > 0.4; if (okan.userData.tex !== 'm_win') setPaper(okan, 'm_win', 1.4); okan.position.set(winX - 0.1, 0.4, R.z0 + 0.7)
  } else if (a.vis === 'peek') {
    const open = k < 1.7 ? 0.75 * ease(k / 0.5) : 0.75 * (1 - ease((k - 1.7) / 0.4))
    doorPivot.rotation.y = -open; okan.visible = open > 0.1; okan.position.set(DOOR.hx + DOOR.w - 0.12, 0, R.z0 - 0.3)
    if (!a.events.close && k > 1.9) { a.events.close = 1; sfx('dclose', { vol: 0.3 }) }
  } else if (a.vis === 'key-look') {
    const open = k < 1.7 ? 1.2 * ease((k - 0.3) / 0.4) : 1.2 * (1 - ease((k - 1.7) / 0.4))
    doorPivot.rotation.y = -open; okan.visible = open > 0.1; okan.position.set(DOOR.cx + 0.05, 0, R.z0 - 0.4)
    if (!a.events.close && k > 2.0) { a.events.close = 1; sfx('dclose', { vol: 0.6 }) }
  } else {
    doorPivot.rotation.y = lerp(doorPivot.rotation.y, 0, Math.min(1, dt * 12))
    if (a.how !== 'push-win' || k > 0.15) okan.visible = false
  }
  if (a.intent === 'LADDER' && a.vis !== 'window-in') { ladderK = Math.max(0, 0.85 - k * 0.6); if (ladderK <= 0.05) ladderShow = 0 }
  // 影が帰っていく
  if (a.intent !== 'LADDER') a.sh.x = a.intent === 'LURE' ? lerp(0.95, 1.4, ease(k / 1.2)) : lerp(0, 1.4, ease((k - 0.6) / 1.2))
  if (cat.visible) { cat.position.x = lerp(cat.position.x, DOOR.cx, Math.min(1, dt * 2)); cat.position.z = lerp(cat.position.z, R.z0 - 0.3, Math.min(1, dt * 2)); if (k > 1.6) cat.visible = false }
}
function nextAttempt() {
  const a = G.a
  doorPivot.rotation.y = 0; lever.rotation.z = 0; okan.visible = false; okan2.visible = false; cat.visible = false; ladderShow = 0; ladderK = 0
  if (heroState !== 'idle') setHero('idle')
  loopVol('game', 0.16)
  if (a.tut) {
    G.tutStep++
    if (G.tutStep < TUT.length) { G.a = newAttempt(TUT[G.tutStep], true); say('hint', T(TUT[G.tutStep].hint), '', 99) }
    else { store.set('okan_tut', '1'); say('hint', T('tutGo'), '', 1.8); G.tutEnd = G.clock + 1.8; G.a = null; G.mode = 'tutgap' }
    return
  }
  G.i++
  if (G.i >= G.day.length) return beginEnding()
  G.a = newAttempt(G.day[G.i])
}
function startTutorial() {
  G.mode = 'tut'; G.tutStep = 0; G.hour = 6.75; setHero('idle'); resetDoor(); notes.clear()
  G.a = newAttempt(TUT[0], true); say('hint', T(TUT[0].hint), '', 99)
}

// ============================================================ 夜（ドアの前のおにぎり）と結果
function beginEnding() {
  G.mode = 'end'; G.endT = 0; G.a = null; G.hour = 22
  if (window.TM) TM.end(G.score, G.breach <= 2)
}
function stepEnding(dt) {
  G.endT += dt; const t = G.endT
  if (t > 0.6 && !G.ev1) { G.ev1 = 1; sfx('step', { vol: 0.3, dest: 'muf' }); sfx('step', { vol: 0.3, dest: 'muf', delay: 0.4 }) }
  if (t > 1.6 && !G.ev2) { G.ev2 = 1; sfx('dish', { vol: 0.6 }); say('bubble', L(OD.NIGHT), '', 2.4) }
  if (t > 4.2 && !G.ev3) { G.ev3 = 1; if (!SIM) showEnd() }
  if (SIM && t > 4.2) G.mode = 'done'
}
function showEnd() {
  unsay('bubble'); unsay('stamp'); unsay('hbubble')
  $('eHero').src = 'img/h_onigiri.webp'; $('ePlate').src = 'img/onigiri.webp'; $('eSticky').src = 'img/sticky.webp'; $('eMemoT').textContent = L(OD.MEMO)
  show('vEnd'); const v = $('vEnd'); v.className = ''
  sfx('dopen', { vol: 0.4 })
  setTimeout(() => v.classList.add('s1'), 300); setTimeout(() => { v.classList.add('s2'); sfx('page', { vol: 0.5 }) }, 1100); setTimeout(() => v.classList.add('s3'), 2000)
  G.endTimer = setTimeout(showResult, 5200)
  v.onclick = () => { if (v.classList.contains('s2')) showResult() }
}
function titleFor(s) { for (const [min, p] of OD.TITLES) if (s >= min) return L(p); return '' }
function noteFor(s) { for (const [min, p] of OD.NOTE) if (s >= min) return L(p); return '' }
async function showResult() {
  if (G.mode === 'result') return
  clearTimeout(G.endTimer); G.mode = 'result'
  try { await Promise.race([document.fonts.load('40px "Yusei Magic"'), new Promise(r => setTimeout(r, 1500))]); await Promise.race([document.fonts.load('600 40px "Klee One"'), new Promise(r => setTimeout(r, 800))]) } catch (e) {}
  await drawNote()
  const held = G.perfect + G.ok
  const text = lang === 'en' ? `Keep Mom Out of My Room | Held ${held}, she got in ${G.breach} "${titleFor(G.score)}" ${T('shareTail')}` : `おかんを部屋に入れるな｜守り切った${held}回・入られた${G.breach}回『${titleFor(G.score)}』 ${T('shareTail')}`
  $('bPost').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://tom3games.github.io/okan-door/')
  show('vResult'); fitNote(); sfx('j_end', { vol: 0.5 })
}
function fitNote() {
  const box = $('noteBox'), c = $('note'); if (!box.clientHeight) return
  const k = Math.min(box.clientWidth / c.width, box.clientHeight / c.height) * 0.97
  c.style.width = Math.floor(c.width * k) + 'px'; c.style.height = Math.floor(c.height * k) + 'px'
}
addEventListener('resize', () => { if (G.mode === 'result') fitNote() })
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src }) }
async function drawNote() {
  const c = $('note'), x = c.getContext('2d'), W = c.width, H = c.height
  const [oni, sticky, mom] = await Promise.all([loadImg('img/onigiri.webp'), loadImg('img/sticky.webp'), loadImg('img/' + (G.score >= 22 ? 'm_down' : 'm_win') + '.webp')])
  x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, W, H)
  x.strokeStyle = 'rgba(90,120,170,.28)'; x.lineWidth = 2; for (let y = 150; y < H; y += 56) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke() }
  x.strokeStyle = 'rgba(200,70,60,.5)'; x.beginPath(); x.moveTo(70, 0); x.lineTo(70, H); x.stroke()
  for (let y = 40; y < H; y += 120) { x.fillStyle = '#e8e0cf'; x.beginPath(); x.arc(30, y, 11, 0, 7); x.fill() }
  const hand = s => `${s}px "Klee One", sans-serif`, mark = s => `${s}px "Yusei Magic", sans-serif`
  x.fillStyle = '#1c1712'; x.font = mark(46); x.textAlign = 'left'; x.fillText(T('noteHead'), 96, 92)
  const d = new Date(); x.font = hand(28); x.textAlign = 'right'; x.fillText(lang === 'en' ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `${d.getMonth() + 1}月${d.getDate()}日`, W - 40, 92)
  x.textAlign = 'left'
  const held = G.perfect + G.ok
  const row = (y, label, n, col) => { x.fillStyle = '#2a2118'; x.font = hand(34); x.fillText(label, 96, y); tally(x, 330, y - 34, n, col); x.font = mark(40); x.fillStyle = col; x.textAlign = 'right'; x.fillText(String(n), W - 50, y); x.textAlign = 'left' }
  row(210, T('held'), held, '#1f4c87'); row(266, T('got'), G.breach, '#c4372b')
  if (G.granny) row(322, T('gran'), G.granny, '#8a5a1f')
  // 称号のはんこ
  const ty = 430
  x.save(); x.translate(250, ty); x.rotate(-0.06); x.strokeStyle = '#c4372b'; x.lineWidth = 6; const tt = titleFor(G.score); x.font = mark(tt.length > 9 ? 44 : 54); const tw = Math.min(330, x.measureText(tt).width + 50)
  x.strokeRect(-tw / 2, -50, tw, 92); x.fillStyle = '#c4372b'; x.textAlign = 'center'; x.fillText(tt, 0, 18, tw - 30); x.font = hand(22); x.fillStyle = '#c4372b'; x.fillText(T('title'), 0, -62); x.restore()
  // おかんの一言
  if (mom) { const h = 230, w = mom.width * h / mom.height; x.drawImage(mom, W - w - 36, ty - 110, w, h) }
  x.font = hand(30); x.fillStyle = '#5d5246'; x.fillText(T('mom'), 96, ty + 150)
  x.font = mark(36); x.fillStyle = '#1c1712'; wrap(x, noteFor(G.score), 96, ty + 206, W - 150, 54)
  // おにぎりとメモ
  if (oni) { const w = 300, h = oni.height * w / oni.width; x.drawImage(oni, 90, H - h - 70, w, h) }
  if (sticky) { const w = 250, h = sticky.height * w / sticky.width; x.save(); x.translate(W - w / 2 - 50, H - h / 2 - 90); x.rotate(0.07); x.drawImage(sticky, -w / 2, -h / 2, w, h); x.font = mark(28); x.fillStyle = '#2a2118'; x.textAlign = 'center'; wrap(x, L(OD.MEMO), 0, -4, w - 50, 36, true); x.restore() }
  x.font = hand(20); x.fillStyle = '#8a7e70'; x.textAlign = 'left'; x.fillText((lang === 'en' ? 'Keep Mom Out of My Room' : 'おかんを部屋に入れるな') + '  tom3games.github.io/okan-door', 96, H - 26)
}
function wrap(x, s, px, py, maxW, lh, center) {
  const lines = [], en = lang === 'en'
  for (const para of s.split('\n')) {
    let cur = ''; const tokens = en ? para.split(' ') : [...para]
    for (const tk of tokens) { const n = cur + (en && cur ? ' ' : '') + tk; if (x.measureText(n).width > maxW && cur) { lines.push(cur); cur = tk } else cur = n }
    if (cur) lines.push(cur)
  }
  const y0 = center ? py - (lines.length - 1) * lh / 2 : py
  lines.forEach((l, i) => x.fillText(l, px, y0 + i * lh))
}
// 正の字で数える
function tally(x, px, py, n, col) {
  x.strokeStyle = col; x.lineWidth = 5; x.lineCap = 'round'
  const S = 34
  for (let g = 0; g * 5 < n && g < 6; g++) {
    const k = Math.min(5, n - g * 5), ox = px + g * (S + 16), oy = py
    const seg = [[0, 0, S, 0], [S / 2, 0, S / 2, S], [S / 2, S / 2, S - 4, S / 2], [6, S / 2 + 2, 6, S], [0, S, S, S]]
    for (let i = 0; i < k; i++) { const [a, b, c2, d] = seg[i]; x.beginPath(); x.moveTo(ox + a, oy + b); x.lineTo(ox + c2, oy + d); x.stroke() }
  }
}

// ============================================================ 画面とボタン
const VIEWS = ['vTitle', 'vHow', 'vPlay', 'vEnd', 'vResult']
function show(id) { for (const v of VIEWS) $(v).hidden = v !== id; $('bMute').hidden = id === 'vResult' || id === 'vEnd' }
function applyLang() {
  document.documentElement.lang = lang
  $('t1').textContent = T('title1'); $('t2').textContent = T('title2'); $('tSub').textContent = T('sub')
  $('bStart').textContent = T('start'); $('bHow').textContent = T('how'); $('bLang').textContent = T('lang')
  $('howH').textContent = T('how'); $('howLead').textContent = L(OD.HOWTO.lead); $('howWarn').textContent = L(OD.HOWTO.warn); $('bHowClose').textContent = T('close'); $('lPrivacy').textContent = T('privacy')
  $('howCredit').textContent = 'Sounds: Work With Sounds (CC BY 4.0), lonemonk (CC BY 3.0)'
  $('howList').innerHTML = ''; for (const [a, b] of OD.HOWTO[lang]) { const li = document.createElement('li'); const s = document.createElement('span'); s.textContent = a; const bb = document.createElement('b'); bb.textContent = b; li.append(s, bb); $('howList').append(li) }
  for (const d of OD.DEF) $('d' + d[0].toUpperCase() + d.slice(1)).querySelector('span').textContent = T(d)
  $('bSkip').textContent = T('skip'); $('bAgain').textContent = T('again'); $('bSave').textContent = T('save'); $('bPost').textContent = T('post')
  const sg = window.__doorSign; if (sg) { const x = sg.userData.c.getContext('2d'); x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, 256, 180); x.fillStyle = 'rgba(240,226,180,.9)'; x.fillRect(90, 0, 76, 18); x.fillStyle = '#1c1712'; x.font = '44px "Yusei Magic", sans-serif'; x.textAlign = 'center'; x.fillText(lang === 'en' ? 'KNOCK' : 'ノック', 128, 82); x.fillText(lang === 'en' ? 'FIRST' : 'してね', 128, 140); sg.userData.t.needsUpdate = true }
}
function firstTouch() {
  Snd.init()
  if (!Snd.loops.room) { Snd.loop('room', S('amb_room'), 0.12); Snd.loop('game', S('game_muf'), 0.16) }
}
function begin() {
  firstTouch(); sfx('click', { vol: 0.6 }); show('vPlay'); G.playNo++
  G.ev1 = G.ev2 = G.ev3 = 0
  if (!store.get('okan_tut') && !params.has('notut')) { startTutorial(); $('bSkip').hidden = false } else { $('bSkip').hidden = true; startDay() }
}
$('bStart').onclick = begin
$('bAgain').onclick = () => { setHero('idle'); begin() }
$('bHow').onclick = () => { firstTouch(); show('vHow') }
$('bHowClose').onclick = () => show('vTitle')
$('bLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('okan_lang', lang); applyLang() }
$('bSkip').onclick = () => { store.set('okan_tut', '1'); $('bSkip').hidden = true; unsay('hint'); unsay('bubble'); nextReset(); startDay() }
function nextReset() { doorPivot.rotation.y = 0; lever.rotation.z = 0; resetDoor(); Snd.loop('vac', null) }
$('bMute').onclick = () => { muted = !muted; store.set('okan_mute', muted ? '1' : '0'); Snd.setMute(muted); $('bMute').classList.toggle('off', muted) }
$('bMute').classList.toggle('off', muted)
$('bSave').onclick = () => { if (window.TM) TM.share('save'); $('note').toBlob(b => { if (!b) return; const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = 'okan-door.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000) }) }
$('bPost').onclick = () => { if (window.TM) TM.share('x') }
for (const b of document.querySelectorAll('.def')) b.addEventListener('pointerdown', e => { e.preventDefault(); const d = b.dataset.d; if (G.a && G.a.phase === 'push') { tap(); return } choose(d) })
canvas.addEventListener('pointerdown', () => tap())

// ============================================================ 毎フレーム
function drawSpill() {
  const x = spillC.getContext('2d'), W = spillC.width, H = spillC.height, y = shadC.getContext('2d')
  x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H); y.clearRect(0, 0, W, H)
  const day = G.hour < 17.5 ? 0.75 : 1
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(255,215,140,${day})`); g.addColorStop(0.45, `rgba(255,195,115,${0.55 * day})`); g.addColorStop(1, 'rgba(255,190,110,0)')
  x.fillStyle = g; x.beginPath(); x.moveTo(W * 0.2, 0); x.lineTo(W * 0.8, 0); x.lineTo(W * 0.98, H); x.lineTo(W * 0.02, H); x.closePath(); x.fill()
  const a = G.a
  if (a && a.phase !== 'quiet' && a.sh.kind !== 'none') {
    const cx = W / 2 + a.sh.x * W * 0.62
    const sway = a.tells.steps === 'tiptoe' ? Math.sin(a.t * 3) * 5 : 0
    const k = a.sh.kind, feet = []
    if (k === 'center' || k === 'aside') feet.push([cx - 22 + sway, 32, 150], [cx + 22 - sway, 32, 150])
    else if (k === 'big') feet.push([cx - 40, 32, 155], [cx - 4, 32, 155], [cx + 46, 70, 110])
    else if (k === 'two') feet.push([cx - 62, 30, 155], [cx - 30, 30, 155], [cx + 26, 36, 170], [cx + 64, 36, 170])
    else if (k === 'low') feet.push([cx, 120, 185])
    else if (k === 'small') feet.push([cx - 13, 22, 100], [cx + 13, 22, 100], [cx + 40, 9, 110])
    const draw = (c, col) => { for (const [fx, w, len] of feet) { const fg = c.createLinearGradient(0, 0, 0, len); fg.addColorStop(0, col(1)); fg.addColorStop(1, col(0)); c.fillStyle = fg; c.beginPath(); c.moveTo(fx - w / 2, 0); c.lineTo(fx + w / 2, 0); c.lineTo(fx + w * 0.95, len); c.lineTo(fx - w * 0.95, len); c.closePath(); c.fill() } }
    x.globalCompositeOperation = 'destination-out'; draw(x, v => `rgba(0,0,0,${v})`)
    draw(y, v => `rgba(14,8,4,${v * 0.97})`)
  }
  spillT.needsUpdate = true; shadT.needsUpdate = true
}
function drawTV(t) {
  const x = tvC.getContext('2d'), paused = heroState === 'sleep' || heroState === 'hide'
  x.fillStyle = paused ? '#141820' : '#1c2a4a'; x.fillRect(0, 0, 192, 112)
  if (paused) { x.fillStyle = '#556'; x.fillRect(84, 42, 8, 28); x.fillRect(100, 42, 8, 28); tvT.needsUpdate = true; return }
  x.fillStyle = '#2f6e3a'; x.fillRect(0, 86, 192, 26)
  for (let i = 0; i < 4; i++) { const px = ((t * 40 + i * 60) % 230) - 20; x.fillStyle = '#7a8fb8'; x.fillRect(192 - px, 56 - i % 2 * 20, 22, 30) }
  x.fillStyle = '#f2c14e'; x.fillRect(40, 64 - Math.abs(Math.sin(t * 4)) * 22, 14, 22); tvT.needsUpdate = true
}
function setTimeOfDay(h) {
  const [top, bot] = sky(h)
  const dayK = clamp((19 - h) / 2, 0, 1)
  lights.sun.intensity = 1.5 * dayK; lights.sun.color.copy(bot)
  lights.hemi.intensity = 0.25 + 0.5 * dayK
  winLight.color.copy(top); winLight.intensity = 0.3 + 0.9 * dayK
  const night = h >= 18
  lampLight.intensity = night ? 1.6 : 0; lamp.material.emissiveIntensity = night ? 1.2 : 0.15
  renderer.toneMappingExposure = 1.05
  scene.background = null
  const tint = night ? 0.92 : 1
  for (const m of PAPERS) m.material.color.setScalar(tint)
  drawWindow(h); drawClock(h)
}
let ambNow = ''
function updateAmb(h) {
  if (SIM || !Snd.ctx) return
  const want = G.mode === 'title' || G.mode === 'boot' ? 'amb_day' : h < 10 ? 'amb_morning' : h < 18 ? 'amb_day' : 'amb_night'
  if (want !== ambNow) { ambNow = want; Snd.loop('amb', S(want), want === 'amb_night' ? 0.35 : 0.3, 1.2) }
  const tv = h >= 12 && h < 21.5 && G.mode === 'play'
  if (tv && !Snd.loops.tv) Snd.loop('tv', S('tv_laugh'), 0.1, 1.5); else if (!tv && Snd.loops.tv) Snd.loop('tv', null)
}

function textsDom() {
  const now = G.clock
  for (const k of ['bubble', 'hbubble', 'stamp', 'hint']) { const v = G.texts[k]; if (v && now > v.until && k !== 'hint') G.texts[k] = null; if (v && k === 'hint' && now > v.until) G.texts[k] = null }
  // 同時に2つまで（古い物から消す）
  const live = Object.entries(G.texts).filter(([, v]) => v).sort((a, b) => a[1].born - b[1].born)
  while (live.length > 2) { const [k] = live.shift(); G.texts[k] = null }
  const el = { bubble: $('bubble'), hbubble: $('hbubble'), stamp: $('stamp'), hint: $('hint') }
  for (const k in el) {
    const v = G.texts[k], e = el[k]
    if (!v) { if (!e.hidden) e.hidden = true; continue }
    if (e.textContent !== v.text || e.hidden) { e.textContent = v.text; e.className = (k === 'bubble' || k === 'hbubble' ? 'bubble ' : k === 'stamp' ? 'stamp ' : 'hint ') + v.cls + (k === 'hbubble' ? ' hero' : ''); e.hidden = false; void e.offsetWidth }
  }
  // 吹き出しの位置（ドアの上 / 窓 / 主人公の頭）
  const place = (e, world, side) => {
    if (e.hidden) return
    const v = world.clone().project(camera), W = innerWidth, H = innerHeight
    let px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H
    const w = e.offsetWidth, h = e.offsetHeight
    let left = side === 'left' ? px - w : px - 10
    left = clamp(left, 12, W - w - 12); const top = clamp(py - h, 64, H - h - 140)
    e.style.left = Math.round(left) + 'px'; e.style.top = Math.round(top) + 'px'
  }
  const a = G.a
  place(el.bubble, a && a.intent === 'LADDER' ? new THREE.Vector3(winX - 0.3, winY + 0.4, R.z0) : new THREE.Vector3(DOOR.cx - 0.1, 2.0, R.z0 + 0.1))
  const hp = hero.position.clone(); hp.y += hero.userData.h * (heroState === 'sleep' ? 1.3 : 0.95)
  place(el.hbubble, hp, 'left')
}
function defsDom() {
  const a = G.a
  const can = a && a.phase === 'approach'
  for (const d of OD.DEF) { const b = $('d' + d[0].toUpperCase() + d.slice(1)); b.classList.toggle('on', !!a && a.def === d); b.classList.toggle('lock', !can && !(a && a.phase === 'push' && d === 'hold')); b.classList.toggle('mash', !!a && a.phase === 'push' && d === 'hold') }
  $('dSleep').classList.toggle('warn', G.streak >= 2); $('dHold').classList.toggle('warn', G.F >= 2)
  // チュートリアルの指
  let f = $('finger')
  const want = a && a.tut && a.phase === 'approach' && a.t >= a.deadline - 0.01 && a.def !== a.want ? a.want : a && a.tut && a.phase === 'push' ? 'hold' : null
  if (want) {
    if (!f) { f = document.createElement('div'); f.id = 'finger'; f.className = 'finger'; f.innerHTML = '<svg viewBox="0 0 44 44"><path d="M16 4c2 0 4 2 4 4v12l2-1c2-1 4 0 5 1l6 3c2 1 3 3 3 5l-2 10H14L8 28c-1-2 0-4 2-4s3 1 4 2V8c0-2 0-4 2-4z" fill="#fff" stroke="#222" stroke-width="2.5"/></svg>'; $('vPlay').append(f) }
    const r = $('d' + want[0].toUpperCase() + want.slice(1)).getBoundingClientRect(); f.style.left = (r.left + r.width / 2 - 8) + 'px'; f.style.top = (r.top + r.height / 2 - 10) + 'px'; f.hidden = false
  } else if (f) f.hidden = true
}

const STEP = 1 / 60
let last = performance.now(), acc = 0, tvT0 = 0
function logic(dt) {
  G.clock += dt
  if (G.mode === 'play' || G.mode === 'tut') {
    if (G.bot && G.a && !SIM) G.bot(api, G.botSt || (G.botSt = { r: mulberry(5) }))
    if (G.a) stepAttempt(dt)
    if (G.mode === 'play' && G.a) { const a = G.a, exp = a.quiet + a.deadline + 2.6; G.hour = 7 + 15 * (G.i + clamp((a.phase === 'quiet' ? a.t : a.quiet + (a.phase === 'approach' ? a.t : a.deadline + (a.rt || 0))) / exp, 0, 1)) / N_SLOTS }
  } else if (G.mode === 'tutgap') { if (G.clock > G.tutEnd) { $('bSkip').hidden = true; startDay() } }
  else if (G.mode === 'end') { G.hour = Math.min(22, G.hour + dt); stepEnding(dt) }
}
function render(dtR) {
  tvT0 += dtR
  // 主人公のゆれ
  const b = hero.userData.base || [0, 0, 0]
  const bob = heroState === 'idle' ? Math.abs(Math.sin(G.clock * 2.2)) * 0.015 : heroState === 'hold' ? Math.sin(G.clock * 30) * 0.008 * (G.a && G.a.phase === 'push' ? 2 : 0.3) : heroState === 'busted' ? Math.abs(Math.sin(G.clock * 8)) * 0.05 : 0
  hero.position.set(b[0] + (heroState === 'hold' && G.F >= 2 ? Math.sin(G.clock * 40) * 0.01 : 0), b[1] + bob, b[2])
  // 切り絵はカメラの方を向く（縦軸だけ）
  for (const m of PAPERS) { if (!m.visible) continue; m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z) * (heroState === 'sleep' && m === hero ? 0.3 : 1) }
  camera.position.copy(CAM.p); camera.lookAt(CAM.t)
  setTimeOfDay(G.hour); drawSpill(); drawTV(tvT0)
  hallLight.intensity = 2.2; gapLine.material.color.set(G.hour < 17.5 ? '#ffe2b0' : '#ffd08a')
  look.update(); fx.update(dtR); fx.applyCamera()
  renderer.render(scene, camera)
  textsDom(); defsDom(); updateAmb(G.hour)
}
function loop(now) {
  requestAnimationFrame(loop)
  let dt = (now - last) / 1000; last = now
  if (dt > 0.25) dt = 0.25
  if (!G.paused) { acc += dt * (G.speed || 1); let n = 0; while (acc >= STEP && n < 240) { logic(STEP); acc -= STEP; n++ } }
  render(G.paused ? 0 : dt)
}

// ============================================================ 検証用の窓口と、bot を早回しで回す sim
function simRun(bot, seed, opt = {}) {
  SIM = true; const keep = { mode: G.mode, a: G.a }
  G.texts = { bubble: null, hbubble: null, stamp: null, hint: null }
  params.delete('seed'); G.playNo = 0
  G.seed = seed; G.day = makeDay(seed); G.i = 0; G.F = 0; G.streak = 0; G.score = 0; G.perfect = 0; G.ok = 0; G.breach = 0; G.granny = 0; G.log = []
  G.mode = 'play'; G.a = newAttempt(G.day[0]); G.ev1 = G.ev2 = G.ev3 = 0
  const st = { r: mulberry(seed * 7 + 1) }
  let n = 0
  while (G.mode === 'play' && n < 60 * 600) { if (G.a) bot(api, st); logic(STEP); n++ }
  const res = { seed, score: G.score, perfect: G.perfect, ok: G.ok, breach: G.breach, granny: G.granny, log: G.log.slice(), sec: Math.round(n / 60) }
  G.mode = 'title'; G.a = null; SIM = false; resetDoor(); setHero('idle'); doorPivot.rotation.y = 0
  return res
}
const api = {
  get state() { const a = G.a; return { mode: G.mode, i: G.i, n: G.day ? G.day.length : 0, phase: a && a.phase, t: a && a.t, def: a && a.def, deadline: a && a.deadline, intent: a && a.intent, id: a && a.id, score: G.score, breach: G.breach, perfect: G.perfect, ok: G.ok, granny: G.granny, F: G.F, streak: G.streak, hour: G.hour, tut: a && a.tut, taps: a && a.taps, p: a && a.p, heroState } },
  tells, choose, tap, makeDay, simRun, OD,
  texts: () => Object.values(G.texts).filter(Boolean).map(v => v.text),
  day: () => G.day,
  dbg: {
    pause(v = true) { G.paused = v; if (!v) last = performance.now() },
    step(n = 1) { for (let i = 0; i < n; i++) logic(STEP); render(0) },
    speed(k) { G.speed = k },
    render() { render(0) },
    // 台本どおりに状態を作る（撮影用）
    set(o) { Object.assign(G, o) },
    G, spill, spillC, scene, camera, CAM, frame,
    showResult, setHero,
    endNow() { beginEnding(); G.endT = 4.1 },
    // 手口の並びを決めて始める（撮影・テスト用）
    force(ids, i = 0) { doorPivot.rotation.y = 0; lever.rotation.z = 0; G.day = ids.map((id, k) => ({ id, intent: OD.TACTICS[id].intent, line: id === 'lure' ? OD.LURES[Math.min(4, k)] : OD.TACTICS[id].lines[0] })); G.i = i; G.mode = 'play'; G.a = newAttempt(G.day[i]); resetDoor(); setHero('idle'); show('vPlay') },
  },
}
window.okan = api

// ============================================================ 起動
applyLang()
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => applyLang())
const PRE = ['h_idle', 'h_hold', 'h_shout', 'h_sleep', 'h_hide']
const LATER = ['h_tired', 'h_busted', 'h_onigiri', 'h_win', 'm_knock', 'm_tray', 'm_peek', 'm_laundry', 'm_phone', 'm_key', 'm_delivery', 'm_ladder', 'm_cat', 'm_vacuum', 'm_win', 'm_down', 'dad', 'grandma', 'cat', 'onigiri', 'sticky']
let readyDone = false
function ready() {
  if (readyDone) return; readyDone = true
  for (const n of LATER) tex(n)
  window.__bootDone = true; $('boot').classList.add('gone')
  G.mode = 'title'; G.hour = 7.5; show('vTitle')
  window.__okanReady = true
}
let pending = PRE.length
for (const n of PRE) { const t = tex(n); const chk = () => { if (t.image && t.image.complete !== false && t.image.width) { if (window.__bootStep) __bootStep(); if (--pending <= 0) ready() } else setTimeout(chk, 50) }; chk() }
setTimeout(ready, 9000)
G.hour = 7.5; setHero('idle')
requestAnimationFrame(t => { last = t; loop(t) })
