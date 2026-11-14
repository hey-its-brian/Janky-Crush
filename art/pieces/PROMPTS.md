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

## Cage and portal

`tools/make-cage.py` makes these two sprites. They are not cut by
`tools/cut-art.py`.

The cage (`cage.webp`) is built from two pictures, so that the bars are
straight and line up with the cell. Z-Image Turbo, seed 7, 8 steps.

pole (1536 x 864):

> One single straight thick green bamboo pole lying perfectly horizontal,
> seen from the side, spanning the picture from left to right, with three
> bamboo node rings, cut flat at both ends. Stylized 3D cartoon render,
> soft rounded chunky shape, glossy, very vivid saturated green, soft
> highlight along the top. Centered, plain flat bright magenta pink
> background, no ground, no shadow, no text, no leaves, no other objects.

knot (1024 x 1024):

> One single chunky round knot of thick beige rope, a ball of rope wrapped
> in a criss-cross X pattern, seen from the front. Stylized 3D cartoon
> render, soft rounded chunky shape, warm beige and tan colors, soft
> highlight on the upper left. Centered, fills half of the frame, plain
> flat bright magenta pink background, no ground, no shadow, no text, no
> other objects.

The portal swirl (`portal.webp`) is white light on black (1024 x 1024).
The tool makes the black see-through, and the game tints the swirl in each
portal color.

> A magical swirling vortex portal seen from directly above, a perfect
> circle. Soft glowing spiral arms of white and pale silver light turning
> toward a bright center, with tiny sparkles, cartoon game effect,
> stylized 3D render, smooth and soft. Monochrome white light only.
> Centered, fills most of the frame, pure solid black background, no text,
> no frame, no objects.

## Jam

The jam blocker (`jam.webp`) is cut out by `tools/cut-art.py pieces`.
Z-Image Turbo gave a false "maybe not safe" picture for jam prompts, so
this one is from Qwen-Image (`mcp-tools/Qwen-Image`), 1:1, seed 7.

> A rounded square cushion of purple blueberry jam, like a thick spoonful
> of fruit preserve with a soft wavy edge, shiny highlights, with three
> whole blueberries and one raspberry on top. Single isolated game piece
> for a casual match-3 mobile puzzle game, front view, stylized 3D cartoon
> render, soft rounded chunky shapes, very vivid saturated candy colors,
> glossy, big soft highlight on the upper left, centered, the whole object
> visible with empty space around it, plain flat white background, no
> ground, no shadow.

Negative prompt: text, watermark, jar, spoon, bread, plate, blurry, low
resolution.
