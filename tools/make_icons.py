"""Vygeneruje PNG ikony (tartan + zatáčka drah) bez externích knihoven: python tools/make_icons.py"""
import math, random, struct, zlib
from pathlib import Path

TARTAN = (184, 64, 42)
LINE = (245, 242, 234)

def render(size):
    rnd = random.Random(7)
    s = size / 512
    cx, cy = 560 * s, 600 * s          # střed zatáčky mimo ikonu vpravo dole
    radii = [r * s for r in (250, 318, 386, 454, 522)]
    lw = 9 * s
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            n = rnd.random()
            k = 1 - 0.16 * n                # zrno tartanu
            r, g, b = (int(c * k) for c in TARTAN)
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            cover = max(max(0.0, min(1.0, lw / 2 + .5 - abs(d - rr))) for rr in radii)
            if cover:
                r, g, b = (int(a + (l - a) * cover) for a, l in zip((r, g, b), LINE))
            row += bytes((r, g, b))
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, data):
        c = struct.pack('>I', len(data)) + t + data
        return c + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

out = Path(__file__).resolve().parent.parent / 'icons'
for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    (out / name).write_bytes(render(size))
    print(name, size)
