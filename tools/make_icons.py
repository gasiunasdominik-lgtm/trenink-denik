"""Ikona aplikace „Dráha“ (tartan se zatáčkou a namalovaným „10“). Kreslí se ve 2048 px a zmenšuje.
Spuštění: python tools/make_icons.py   (potřebuje Pillow a písmo Bahnschrift z Windows)"""
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter

S = 2048
TARTAN = (184, 64, 42)
TARTAN_L = (208, 86, 58)
INK = (245, 242, 234)
BG = (13, 13, 12)
AMBER = (255, 184, 28)
OUT = Path(__file__).resolve().parent.parent / 'icons'
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



if __name__ == '__main__':
    big = a_draha()
    for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)]:
        big.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        print(name)
