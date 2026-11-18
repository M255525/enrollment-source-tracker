# 產生 PWA 圖示：白板方格底＋三條長條（藍、藍、橘）＋上升箭頭
import os
from PIL import Image, ImageDraw
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
os.makedirs(out, exist_ok=True)

def draw(size, pad):
    s = 4 * size
    im = Image.new('RGB', (s, s), '#F4F5F1')
    d = ImageDraw.Draw(im)
    for k in range(0, s, s // 12):
        d.line([(k, 0), (k, s)], fill='#E3E4DD', width=max(1, s // 256)); d.line([(0, k), (s, k)], fill='#E3E4DD', width=max(1, s // 256))
    x0, x1 = pad * s, (1 - pad) * s
    w = x1 - x0
    base = x0 + w * .82
    bw = w * .17
    for i, (h, c) in enumerate(((.3, '#2A78D6'), (.48, '#2A78D6'), (.66, '#EB6834'))):
        bx = x0 + w * (.16 + i * .25)
        d.rounded_rectangle([bx, base - w * h, bx + bw, base], radius=w * .03, fill=c)
    d.line([(x0 + w * .12, base + w * .03), (x0 + w * .88, base + w * .03)], fill='#0B0B0B', width=int(w * .025))
    pts = [(x0 + w * .2, x0 + w * .42), (x0 + w * .45, x0 + w * .3), (x0 + w * .7, x0 + w * .16)]
    d.line(pts, fill='#0B0B0B', width=int(w * .035), joint='curve')
    ax, ay = pts[-1]
    d.polygon([(ax + w * .08, ay - w * .05), (ax - w * .02, ay - w * .04), (ax + w * .04, ay + w * .05)], fill='#0B0B0B')
    return im.resize((size, size), Image.LANCZOS)

draw(192, .06).save(os.path.join(out, 'icon-192.png'))
draw(512, .06).save(os.path.join(out, 'icon-512.png'))
draw(512, .18).save(os.path.join(out, 'icon-maskable-512.png'))
print('ok')
