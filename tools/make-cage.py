"""Builds two board sprites from generated pictures in art/source/pieces/:

  cage.webp    the bamboo cage over a locked fruit, put together from one
               bamboo pole and one rope knot so the bars line up exactly
  portal.webp  the swirl inside a portal: white light, see-through where
               the picture was black, so the game can tint it

    pip install pillow numpy scipy
    python3 tools/make-cage.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'source', 'pieces')
OUT = os.path.join(ROOT, 'art', 'pieces')
S = 512  # working size


def cut_pink(name):
    """The picture without its pink background, cropped to the object."""
    im = Image.open(os.path.join(SRC, f'{name}.webp')).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pink = (np.minimum(r, b) - g) > 6
    labels, _ = ndimage.label(pink)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    keep = ~np.isin(labels, border[border > 0])
    # Only the biggest object: drops specks.
    parts, n = ndimage.label(keep)
    if n > 1:
        keep = parts == (1 + np.argmax(ndimage.sum(keep, parts, range(1, n + 1))))
    alpha = Image.fromarray(np.where(keep, 255, 0).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    # Take the pink tint off the edges that are left.
    spill = np.clip(np.minimum(r, b) - g, 0, None)
    rgb = np.clip(np.stack([r - spill * 0.9, g + spill * 0.1, b - spill * 0.9], -1), 0, 255).astype(np.uint8)
    out = Image.fromarray(rgb).convert('RGBA')
    out.putalpha(alpha)
    return out.crop(alpha.getbbox())


def shadowed(layer, offset=5, blur=5, strength=0.45):
    """The layer on its own soft drop shadow."""
    out = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    dark = Image.new('RGBA', layer.size, (20, 40, 0, 255))
    alpha = layer.getchannel('A').filter(ImageFilter.GaussianBlur(blur)).point(lambda v: round(v * strength))
    out.paste(dark, (0, offset), alpha)
    out.alpha_composite(layer)
    return out


def cage():
    pole = cut_pink('pole')
    knot = cut_pink('knot')
    thick = round(S * 0.135)
    horiz = pole.resize((S - 8, thick), Image.LANCZOS)
    vert = horiz.transpose(Image.ROTATE_270)
    k = round(S * 0.2)
    knot = knot.resize((k, round(k * knot.height / knot.width)), Image.LANCZOS)
    at = [round(S * 0.295), round(S * 0.705)]  # the bars' center lines

    bars_h = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bars_v = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    knots = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    for p in at:
        bars_h.alpha_composite(horiz, (4, p - thick // 2))
        bars_v.alpha_composite(vert, (p - thick // 2, 4))
    for x in at:
        for y in at:
            knots.alpha_composite(knot, (x - knot.width // 2, y - knot.height // 2))
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    for layer in (bars_h, bars_v, knots):
        out.alpha_composite(shadowed(layer))
    out.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, 'cage.webp'), quality=92, method=6)


def portal():
    im = Image.open(os.path.join(SRC, 'portal.webp')).convert('L').resize((S, S), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    yy, xx = np.mgrid[0:S, 0:S]
    d = np.hypot(xx - S / 2, yy - S / 2) / (S / 2)
    edge = np.clip((0.9 - d) / 0.12, 0, 1)             # a clean round edge
    alpha = np.clip((a - 0.3) * 1.6, 0, 1) * edge
    rgba = np.dstack([np.full((S, S, 3), 255, np.uint8), (alpha * 255).astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').crop((26, 26, S - 26, S - 26)).resize((256, 256), Image.LANCZOS).save(
        os.path.join(OUT, 'portal.webp'), quality=92, method=6)


if __name__ == '__main__':
    cage()
    portal()
