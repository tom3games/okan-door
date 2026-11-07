# 生成したシート（緑背景・3体横並び）を切り抜いて img/*.webp にする。~/tools/pyimg/bin/python art/key.py
# 切り方は kobito-vs-okan/art/key.py と同じ（緑を抜く→輪郭の外に紙の白い縁）。列は透明度の縦の投影で自動で割る
import numpy as np, os, sys
from PIL import Image, ImageFilter
D = os.path.dirname(os.path.abspath(__file__)); OUT = D + '/../img/'
RAW = os.path.expanduser('~/Desktop/claudecode/_art_raw/okan-door/')
RIM = 7
MAXH = 560
SHEETS = {
  'hero_a': ['h_idle', 'h_hold', 'h_shout'],
  'hero_b': ['h_sleep', 'h_hide', 'h_tired'],
  'hero_c': ['h_busted', 'h_onigiri', 'h_win'],
  'mom_door_a': ['m_knock', 'm_tray', 'm_peek'],
  'mom_door_b': ['m_laundry', 'm_phone', 'm_key'],
  'mom_door_c': ['m_delivery', 'm_ladder', 'm_cat'],
  'fam_a': ['dad', 'grandma', 'm_win'],
  'items': ['onigiri', 'mikan', 'sticky'],
}
def alpha(a):
  r, g, b = a[..., 0], a[..., 1], a[..., 2]
  k = g - np.maximum(r, b)
  al = 1 - np.clip((k - 22) / (90 - 22), 0, 1)
  lim = np.maximum(r, b); g2 = np.where(g > lim, lim, g)
  return np.dstack([r, g2, b, al * 255]).clip(0, 255).astype(np.uint8)
def rimmed(im):
  a = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7)); im.putalpha(a)
  rim = a.point(lambda v: 255 if v > 60 else 0).filter(ImageFilter.MaxFilter(RIM * 2 + 1)).filter(ImageFilter.GaussianBlur(0.8))
  paper = Image.new('RGBA', im.size, (255, 253, 246, 0)); paper.putalpha(rim)
  return Image.alpha_composite(paper, im)
def segments(mask):
  col = mask.sum(0) > 2
  segs, s = [], None
  for x, v in enumerate(col):
    if v and s is None: s = x
    if not v and s is not None: segs.append([s, x]); s = None
  if s is not None: segs.append([s, len(col)])
  # 小さい切れ端（動きの線など）は近い大きい塊にまとめる
  mass = lambda sg: mask[:, sg[0]:sg[1]].sum()
  while len(segs) > 3:
    i = min(range(len(segs)), key=lambda k: mass(segs[k]))
    if i == 0: j = 1
    elif i == len(segs) - 1: j = i - 1
    else: j = i - 1 if segs[i][0] - segs[i - 1][1] < segs[i + 1][0] - segs[i][1] else i + 1
    a, b = sorted([i, j]); segs[a] = [segs[a][0], segs[b][1]]; del segs[b]
  return segs
def cut(sheet, names):
  src = RAW + sheet + '.png'
  if not os.path.exists(src): print('なし', sheet); return
  rgba = alpha(np.asarray(Image.open(src).convert('RGB')).astype(np.float32))
  mask = rgba[..., 3] > 128
  segs = segments(mask)
  if len(segs) != 3: print('列が3つに割れない', sheet, segs); return
  for (x0, x1), name in zip(segs, names):
    rows = np.where(mask[:, x0:x1].sum(1) > 0)[0]; y0, y1 = rows[0], rows[-1] + 1
    pad = RIM + 4
    box = (max(0, x0 - pad), max(0, y0 - pad), min(rgba.shape[1], x1 + pad), min(rgba.shape[0], y1 + pad))
    im = rimmed(Image.fromarray(rgba[box[1]:box[3], box[0]:box[2]].copy(), 'RGBA'))
    s = min(1, MAXH / im.height, 640 / im.width)
    if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(OUT + name + '.webp', quality=86, method=6)
    print(name, im.size, os.path.getsize(OUT + name + '.webp'))
for k in (sys.argv[1:] or SHEETS):
  cut(k, SHEETS[k])
