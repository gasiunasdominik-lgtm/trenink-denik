"""Varianty ikony aplikace A–F (náhled v icons.html). Kreslí se ve 2048 px a zmenšují na 1024/512/180.
Spuštění: python tools/make_icon_variants.py   (potřebuje Pillow a písmo Bahnschrift z Windows)"""
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter

S = 2048
TARTAN = (184, 64, 42)
TARTAN_L = (208, 86, 58)
INK = (245, 242, 234)
BG = (13, 13, 12)
AMBER = (255, 184, 28)
OUT = Path(__file__).resolve().parent.parent / 'icons' / 'varianty'
FONT = r'C:\Windows\Fonts\bahnschrift.ttf'


def font(size, style='Bold Condensed'):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(style)
    return f


def grain(img, strength=0.16, seed=7):
    """Zrno tartanu: šum násobený do obrázku."""
    random.seed(seed)
    noise = Image.effect_noise((S // 2, S // 2), 64).resize((S, S)).convert('L')
    noise = noise.point(lambda v: int(255 - strength * (255 - v) * 1.6))
    return ImageChops.multiply(img, Image.merge('RGB', (noise, noise, noise)))


def text_center(d, xy, txt, f, fill, anchor='mm'):
    d.text(xy, txt, font=f, fill=fill, anchor=anchor)


# ---------------------------------------------------------------- A · Dráha
def a_draha():
    im = Image.new('RGB', (S, S), TARTAN)
    d = ImageDraw.Draw(im)
    cx, cy = S * 1.12, S * 1.18
    for r in (900, 1150, 1400, 1650, 1900):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=INK, width=34)
    im = grain(im)
    d = ImageDraw.Draw(im)
    text_center(d, (S * 0.36, S * 0.47), '10', font(1250), INK)
    return im


# ---------------------------------------------------------------- B · Startovní číslo
def b_bib():
    im = grain(Image.new('RGB', (S, S), TARTAN))
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = S * 0.12, S * 0.2, S * 0.88, S * 0.8
    d.rounded_rectangle((x0 + 30, y0 + 40, x1 + 30, y1 + 40), radius=60, fill=(120, 40, 26))  # stín
    d.rounded_rectangle((x0, y0, x1, y1), radius=60, fill=(239, 235, 226))
    d.rectangle((x0, y0 + 0, x1, y0 + 230), fill=BG)
    d.rounded_rectangle((x0, y0, x1, y0 + 230), radius=60, fill=BG)
    d.rectangle((x0, y0 + 120, x1, y0 + 230), fill=BG)
    for px, py in ((x0 + 95, y0 + 330), (x1 - 95, y0 + 330), (x0 + 95, y1 - 95), (x1 - 95, y1 - 95)):
        d.ellipse((px - 34, py - 34, px + 34, py + 34), fill=TARTAN)
    text_center(d, ((x0 + x1) / 2, y0 + 120), 'DESETIBOJ', font(150, 'Bold SemiCondensed'), INK)
    text_center(d, ((x0 + x1) / 2, (y0 + 230 + y1) / 2 + 20), '10', font(900), (18, 18, 18))
    return im


# ---------------------------------------------------------------- C · Tabule
DIGITS = {
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '0': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
}


def c_tabule():
    im = Image.new('RGB', (S, S), (8, 8, 8))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((S * 0.08, S * 0.2, S * 0.92, S * 0.8), radius=40, outline=(46, 46, 46), width=24)
    pitch, r = 128, 50
    w = 11 * pitch
    ox, oy = (S - w) / 2 + pitch / 2, S / 2 - 3 * pitch
    for di, ch in enumerate('10'):
        for row, bits in enumerate(DIGITS[ch]):
            for col, b in enumerate(bits):
                x = ox + (di * 6 + col) * pitch
                y = oy + row * pitch
                d.ellipse((x - r, y - r, x + r, y + r), fill=AMBER if b == '1' else (34, 30, 22))
    glow = im.filter(ImageFilter.GaussianBlur(40))
    im = ImageChops.screen(im, glow.point(lambda v: int(v * 0.6)))
    d = ImageDraw.Draw(im)
    d.rectangle((S * 0.08, S * 0.84, S * 0.92, S * 0.84 + 40), fill=TARTAN)
    return im


# ---------------------------------------------------------------- D · Razítko
def d_razitko():
    im = Image.new('RGB', (S, S), BG)
    stamp = Image.new('L', (S, S), 0)
    sd = ImageDraw.Draw(stamp)
    sd.rounded_rectangle((S * 0.13, S * 0.25, S * 0.87, S * 0.75), radius=70, outline=255, width=90)
    sd.text((S / 2, S / 2 + 20), '10', font=font(1000), fill=255, anchor='mm')
    stamp = stamp.rotate(-9, resample=Image.BICUBIC)
    # nerovný otisk
    noise = Image.effect_noise((S // 4, S // 4), 90).resize((S, S), Image.BILINEAR).point(lambda v: 255 if v > 70 else 0)
    stamp = ImageChops.multiply(stamp, noise)
    im.paste(Image.new('RGB', (S, S), TARTAN_L), mask=stamp)
    return im


# ---------------------------------------------------------------- E · Desetiboj (10 segmentů)
def e_segmenty():
    im = grain(Image.new('RGB', (S, S), TARTAN))
    d = ImageDraw.Draw(im)
    c, ro, ri = S / 2, S * 0.40, S * 0.27
    for i in range(10):
        a0 = -90 + i * 36 + 3.2
        a1 = a0 + 36 - 6.4
        pts = [(c + ro * math.cos(math.radians(a)), c + ro * math.sin(math.radians(a))) for a in [a0 + (a1 - a0) * t / 20 for t in range(21)]]
        pts += [(c + ri * math.cos(math.radians(a)), c + ri * math.sin(math.radians(a))) for a in [a1 - (a1 - a0) * t / 20 for t in range(21)]]
        d.polygon(pts, fill=INK)
    text_center(d, (c, c + 30), '10', font(560), INK)
    return im


# ---------------------------------------------------------------- F · Cíl zhora
def f_cil():
    im = grain(Image.new('RGB', (S, S), TARTAN))
    d = ImageDraw.Draw(im)
    for x in (S * 0.2, S * 0.4, S * 0.6, S * 0.8):
        d.rectangle((x - 16, 0, x + 16, S), fill=INK)
    y0, cell = S * 0.62, S / 16
    for row in range(2):
        for col in range(16):
            fill = INK if (row + col) % 2 == 0 else BG
            d.rectangle((col * cell, y0 + row * cell, (col + 1) * cell, y0 + (row + 1) * cell), fill=fill)
    text_center(d, (S * 0.5, S * 0.33), '10', font(820), INK)
    return im


VARIANTS = {'a': a_draha, 'b': b_bib, 'c': c_tabule, 'd': d_razitko, 'e': e_segmenty, 'f': f_cil}

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for key, fn in VARIANTS.items():
        big = fn()
        for size in (1024, 512, 180):
            big.resize((size, size), Image.LANCZOS).save(OUT / f'{key}-{size}.png', optimize=True)
        print(key)
