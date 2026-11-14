"""Makes the welcome screen art from the generated pictures in
art/source/title/ (art/title/PROMPTS.md has the prompts):

  logo.webp      the "Janky Crush" logo, cut out of its green background
  backdrop.webp  the hot spring scene, scaled down

    pip install pillow numpy scipy
    python3 tools/make-title.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'source', 'title')
OUT = os.path.join(ROOT, 'art', 'title')


def logo():
    im = Image.open(os.path.join(SRC, 'logo.webp')).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # The background is a strong green with little red. The yuzu leaf at the
    # top is a yellower green, so it stays.
    green = (g - np.maximum(r, b) > 60) & (r < 120)
    # Below the logo the picture has a paler green floor with a shadow on it.
    floor = (g - np.maximum(r, b) > 40) & (np.arange(a.shape[0])[:, None] > a.shape[0] * 0.6)
    green |= floor
    labels, _ = ndimage.label(green)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    keep = ~np.isin(labels, border[border > 0])
    parts, n = ndimage.label(keep)
    if n > 1:  # only the logo: drops specks and the shadow on the ground
        keep = parts == (1 + np.argmax(ndimage.sum(keep, parts, range(1, n + 1))))
    alpha = Image.fromarray(np.where(keep, 255, 0).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.3))
    # Take the green tint off the edges that are left.
    spill = np.clip(g - np.maximum(r, b), 0, None)
    rgb = np.clip(np.stack([r + spill * 0.25, g - spill * 0.75, b + spill * 0.25], -1), 0, 255).astype(np.uint8)
    out = Image.fromarray(rgb).convert('RGBA')
    out.putalpha(alpha)
    out = out.crop(alpha.getbbox())
    out.thumbnail((900, 900), Image.LANCZOS)
    out.save(os.path.join(OUT, 'logo.webp'), quality=92, method=6)
    print('logo', out.size)


def backdrop():
    im = Image.open(os.path.join(SRC, 'backdrop.webp')).convert('RGB')
    im = im.resize((810, 1440), Image.LANCZOS)
    im.save(os.path.join(OUT, 'backdrop.webp'), quality=84, method=6)
    print('backdrop', im.size, 'bottom color', im.crop((200, 1400, 610, 1440)).resize((1, 1)).getpixel((0, 0)))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    logo()
    backdrop()
