"""Draw the home-screen icons (a glowing neon candy on the Night Arcade
background). Run: python3 tools/make-icons.py  (needs Pillow)."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "icons"
BG = (12, 10, 29)
PINK = (255, 61, 139)
CYAN = (45, 226, 230)


def icon(size: int) -> Image.Image:
    s = size * 4  # supersample, then downscale for smooth edges
    img = Image.new("RGB", (s, s), BG)

    # Top pink glow.
    glow = Image.new("L", (s, s), 0)
    ImageDraw.Draw(glow).ellipse((-s * 0.3, -s * 0.55, s * 1.3, s * 0.35), fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.12))
    img.paste(Image.new("RGB", (s, s), PINK), (0, 0), glow)

    # Candy: neon halo, then a glossy body.
    cx, cy, r = s / 2, s * 0.53, s * 0.27
    halo = Image.new("L", (s, s), 0)
    ImageDraw.Draw(halo).ellipse((cx - r * 1.15, cy - r * 1.15, cx + r * 1.15, cy + r * 1.15), fill=255)
    halo = halo.filter(ImageFilter.GaussianBlur(s * 0.06))
    img.paste(Image.new("RGB", (s, s), CYAN), (0, 0), halo)

    body = Image.new("RGB", (s, s), (0, 0, 0))
    bd = ImageDraw.Draw(body)
    steps = 60
    for i in range(steps):
        t = i / steps
        rr = r * (1 - t)
        # deep edge -> bright center, offset toward the upper left
        deep, base, light = (5, 40, 61), (45, 184, 255), (190, 235, 255)
        lo, hi, u = (deep, base, t / 0.35) if t < 0.35 else (base, light, (t - 0.35) / 0.65)
        col = tuple(int(a + (b - a) * u) for a, b in zip(lo, hi))
        ox, oy = -r * 0.25 * t, -r * 0.3 * t
        bd.ellipse((cx + ox - rr, cy + oy - rr, cx + ox + rr, cy + oy + rr), fill=col)
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    img.paste(body, (0, 0), mask)

    # Swirl stripes, clipped to the candy.
    swirl = Image.new("L", (s, s), 0)
    sd = ImageDraw.Draw(swirl)
    for k in range(8):
        a0 = k * 45
        sd.pieslice((cx - r, cy - r, cx + r, cy + r), a0, a0 + 16, fill=90)
    swirl = Image.composite(swirl, Image.new("L", (s, s), 0), mask)
    img.paste(Image.new("RGB", (s, s), (255, 255, 255)), (0, 0), swirl)

    # Specular highlight.
    shine = Image.new("L", (s, s), 0)
    ImageDraw.Draw(shine).ellipse((cx - r * 0.62, cy - r * 0.72, cx - r * 0.05, cy - r * 0.32), fill=235)
    shine = shine.filter(ImageFilter.GaussianBlur(s * 0.012))
    img.paste(Image.new("RGB", (s, s), (255, 255, 255)), (0, 0), shine)

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for size in (180, 192, 512):
        icon(size).save(OUT / f"icon-{size}.png")
        print("wrote", OUT / f"icon-{size}.png")
