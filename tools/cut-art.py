"""Turns the generated pictures in art/source/ into the sprites the game
uses: cuts out the background, adds a soft ground shadow to the map
sprites, and scales each one down.

    pip install "rembg[cpu]" pillow numpy scipy
    python3 tools/cut-art.py            # the map sprites, the ground tile and the host
    python3 tools/cut-art.py hut frog   # only some map sprites
    python3 tools/cut-art.py host       # only the host
    python3 tools/cut-art.py pieces     # only the board pieces

The pictures come from an image model (the PROMPTS.md file beside each
set of sprites has the prompts). Most are on a white background and are cut out with
the rembg model. White and gray things were generated on a pink background
and are cut out by color, which keeps their pale edges ('pink'), or with
the model and then the pink tint is taken off ('model-pink').
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'source', 'map')
OUT = os.path.join(ROOT, 'art', 'map')

# name: (cut method, longest side in px, ground shadow)
SPRITES = {
    'hut': ('model', 384, True), 'beachhut': ('model', 384, True), 'teahouse': ('model', 384, True),
    'yuzutree': ('model', 400, True), 'palm': ('model', 420, True), 'sakura': ('model', 400, True),
    'pine': ('pink', 400, True), 'onsen': ('model-pink', 400, False),
    'torch': ('model', 288, True), 'lantern': ('model', 288, True), 'rocks': ('model', 200, False),
    'redpanda': ('model', 320, True), 'toucan': ('model', 320, False), 'turtle': ('model', 320, True),
    'crab': ('model', 320, True), 'frog': ('model', 320, False), 'monkey': ('model', 320, True),
    'balloon': ('model', 300, False), 'cloud': ('pink', 360, False), 'mountains': ('pink', 960, False),
    'flower': ('model', 96, False), 'tuft': ('model', 128, False),
    'bamboo': ('model', 400, True), 'waterfall': ('model', 400, False), 'panda': ('model-pink', 320, True),
    'mushrooms': ('model', 384, True), 'lanterntree': ('model', 400, True), 'owl': ('model', 320, False),
    'fireflyjar': ('model', 288, True),
}

_session = None


def cut_model(im):
    global _session
    from rembg import new_session, remove
    _session = _session or new_session('isnet-general-use')
    out = remove(im, session=_session, post_process_mask=True)
    # The model keeps a faint haze where the picture had a shadow: drop it.
    out.putalpha(out.getchannel('A').point(lambda v: max(0, min(255, round((v - 110) * 1.8)))))
    return out


def no_pink(im):
    """Takes the pink tint of a pink background off a cut-out sprite."""
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = np.clip(np.minimum(r, b) - g, 0, None)
    out = np.stack([r - spill * 0.9, g + spill * 0.1, b - spill * 0.9], -1)
    out = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert('RGBA')
    out.putalpha(im.getchannel('A'))
    return out


def cut_pink(im):
    """Removes a pink background: everything pink that touches the border.
    Then takes the pink tint off the edges that are left."""
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pink = (np.minimum(r, b) - g) > 34
    labels, _ = ndimage.label(pink)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, border[border > 0])
    alpha = Image.fromarray(np.where(background, 0, 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    return no_pink(out)


def ground_shadow(im):
    """Puts the sprite on a soft dark ellipse, as if it stands on the map."""
    w, h = im.size
    side, pad = round(w * 0.09), round(w * 0.07)       # room for the shadow
    canvas = Image.new('RGBA', (w + side * 2, h + pad), (0, 0, 0, 0))
    shadow = Image.new('L', canvas.size, 0)
    # The shadow is as wide as the part of the sprite that touches the ground.
    foot = im.crop((0, round(h * 0.9), w, h)).getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()
    x0, x1 = (foot[0], foot[2]) if foot else (w * 0.2, w * 0.8)
    grow = w * 0.05
    ImageDraw.Draw(shadow).ellipse((side + x0 - grow, h - pad * 1.1, side + x1 + grow, h + pad * 0.6), fill=85)
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, w * 0.022)))
    canvas.putalpha(shadow)
    canvas.alpha_composite(im, (side, 0))
    return canvas


def save(im, name, size):
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(os.path.join(OUT, f'{name}.webp'), quality=90, method=6)


def recolor(im, hue=None, white=False):
    """A flower or tuft in another color: only the pink or green parts
    change, the yellow center stays."""
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(np.int16)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    center = (h > 20) & (h < 50)                              # yellow
    if white:
        s2, v2, h2 = np.where(center, s, s * 0.12), np.where(center, v, np.minimum(255, v * 1.12 + 20)), h
    else:
        h2, s2, v2 = np.where(center, h, hue), s, v
    out = Image.fromarray(np.stack([h2, s2, v2], -1).astype(np.uint8), 'HSV').convert('RGBA')
    out.putalpha(im.getchannel('A'))
    return out


def ground():
    """A soft mottled tile that repeats with no seam. It is laid over the
    zone colors of the map so the ground is not one flat color."""
    size, rng = 256, np.random.default_rng(7)
    field = np.zeros((size, size))
    yy, xx = np.mgrid[0:size, 0:size]
    for _ in range(70):
        cx, cy, r = rng.uniform(0, size), rng.uniform(0, size), rng.uniform(10, 34)
        dx = np.minimum(abs(xx - cx), size - abs(xx - cx))    # wraps at the edges
        dy = np.minimum(abs(yy - cy), size - abs(yy - cy))
        field += rng.choice([-1, 1]) * np.exp(-(dx * dx + dy * dy * 2.2) / (2 * r * r))
    field /= abs(field).max()
    tile = np.zeros((size, size, 4), np.uint8)
    tile[..., :3] = np.where(field[..., None] > 0, 255, 20)   # light and dark patches
    tile[..., 3] = (abs(field) * 30).astype(np.uint8)
    Image.fromarray(tile, 'RGBA').save(os.path.join(OUT, 'ground.png'), optimize=True)


HOST_POSES = ('idle', 'cheer', 'worried')


def host():
    """The host's poses, all cropped with one box and scaled the same, so
    the character does not change size or move when the pose changes."""
    src, out = os.path.join(ROOT, 'art', 'source', 'host'), os.path.join(ROOT, 'art', 'host')
    os.makedirs(out, exist_ok=True)
    cuts = {p: cut_model(Image.open(os.path.join(src, f'{p}.webp')).convert('RGB')) for p in HOST_POSES}
    boxes = [c.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox() for c in cuts.values()]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    half = max(512 - box[0], box[2] - 512)                    # keep the character centered
    box = (512 - half, box[1], 512 + half, box[3])
    for pose, im in cuts.items():
        im = im.crop(box)
        im.thumbnail((640, 560), Image.LANCZOS)
        im.save(os.path.join(out, f'{pose}.webp'), quality=92, method=6)
        print('cut host', pose, im.size)


# The board pieces that are not fruit: name -> cut method. (The fruit are
# 3D renders, see tools/render-pieces.py.)
PIECES = {
    'bomb': 'model', 'coco1': 'model', 'coco2': 'model', 'mochi1': 'model-green', 'mochi2': 'model-green',
    'gummy': 'model', 'duck': 'model', 'pup': 'model',
}


def no_green(im):
    """Takes the green tint of a green background off a cut-out sprite."""
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = np.clip(g - np.maximum(r, b), 0, None)
    out = np.stack([r + spill * 0.1, g - spill * 0.9, b + spill * 0.1], -1)
    out = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert('RGBA')
    out.putalpha(im.getchannel('A'))
    return out


def pieces():
    """Each board piece cropped to itself and centered in a square, the same
    framing as the fruit renders."""
    src, out = os.path.join(ROOT, 'art', 'source', 'pieces'), os.path.join(ROOT, 'art', 'pieces')
    for name, method in PIECES.items():
        im = cut_model(Image.open(os.path.join(src, f'{name}.webp')).convert('RGB'))
        if method == 'model-green':
            im = no_green(im)
        im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox())
        side = max(im.size)
        pad = round(side * 0.03)
        canvas = Image.new('RGBA', (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
        canvas.paste(im, ((canvas.width - im.width) // 2, (canvas.height - im.height) // 2))
        canvas.resize((256, 256), Image.LANCZOS).save(os.path.join(out, f'{name}.webp'), quality=92, method=6)
        print('cut piece', name)


def main():
    args = sys.argv[1:]
    if 'host' in args or not args:
        host()
    if 'pieces' in args or not args:
        pieces()
    if args and all(a in ('host', 'pieces') for a in args):
        return
    names = [a for a in sys.argv[1:] if a in SPRITES] or list(SPRITES)
    os.makedirs(OUT, exist_ok=True)
    if len(names) == len(SPRITES):
        ground()
    for name in names:
        method, size, shadow = SPRITES[name]
        im = Image.open(os.path.join(SRC, f'{name}.webp')).convert('RGB')
        im = cut_pink(im) if method == 'pink' else cut_model(im)
        if method == 'model-pink':
            im = no_pink(im)
        im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox())
        if shadow:
            im = ground_shadow(im)
        if name == 'flower':
            # Hue is 0-255 in PIL: 20 orange, 150 blue.
            save(recolor(im, hue=20), 'flower-orange', size)
            save(recolor(im, white=True), 'flower-white', size)
            save(recolor(im, hue=150), 'flower-blue', size)
            save(im, 'flower-pink', size)
        elif name == 'tuft':
            save(recolor(im, white=True), 'tuft-snow', size)
            save(im, 'tuft', size)
        else:
            save(im, name, size)
        print('cut', name)


if __name__ == '__main__':
    main()
