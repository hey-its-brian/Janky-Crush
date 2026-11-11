# Board piece prompts

The six fruit (`r o y g b p`, PNG) are 3D renders from
`tools/render-pieces.py`. The other pieces are generated pictures. The
pictures are in `art/source/pieces/`, and `tools/cut-art.py pieces` cuts
them out and writes the WebP sprites in this folder.

## The prompt

Each prompt is a subject, then this text:

> Single isolated game piece for a casual match-3 mobile puzzle game,
> front view, stylized 3D cartoon render, soft rounded chunky shapes, very
> vivid saturated candy colors, big soft highlight on the upper left,
> centered, fills most of the frame, plain flat white background, no
> ground, no shadow, no text.

## Subjects

Model: Z-Image Turbo (`mcp-tools/Z-Image-Turbo` on Hugging Face),
1024 x 1024, seed 7, 8 steps, unless the table gives a different model.

| Sprite | Subject |
|---|---|
| bomb | A single round chubby bright pink dragon fruit with short green-tipped scales, very glossy like polished candy |
| coco2 | A single whole round brown coconut with a thick beige rope tied around its middle in a band with a knot |
| mochi1 | A single soft round white mochi rice cake, plump and squishy, lightly dusted with white powder (bright green background) |
| gummy | A single glossy translucent lime green gummy candy cube with rounded corners, jelly-like, bright and juicy |
| duck | A cute chubby yellow rubber duck bath toy, bright orange beak, big black eyes, smooth and glossy, seen from the side facing left. Model: Qwen-Image (`mcp-tools/Qwen-Image`), 1:1, seed 7. Z-Image Turbo refused this subject. |

## Edits of other pictures

These three are edits with FLUX.1 Kontext Dev
(`mcp-tools/FLUX.1-Kontext-Dev`), seed 5, guidance 2.5, 20 steps, so that
each one matches the picture it comes from.

coco1, from coco2:

> Remove the rope from the coconut. Add one big jagged zigzag crack across
> the middle of the coconut shell, with a little white coconut flesh
> showing inside the crack. Keep the same coconut, the same size, colors,
> 3D style, and the plain white background.

mochi2, from mochi1:

> Add a bold bright pink spiral swirl on the top of the white mochi, like
> a pink candy swirl. Keep the same mochi, the same size, shape, 3D style,
> and the plain green background.

pup, from the host (`art/source/host/idle.webp`):

> Turn this capybara into a tiny baby capybara pup: smaller and rounder
> body, bigger head, bigger sparkly eyes, a happy little smile. Remove the
> orange from its head and put one small green leaf on its head. Keep the
> same colors, the 3D clay style, the sitting position, and the plain
> white background.
