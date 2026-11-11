# Host prompts

The host has three poses: `idle`, `cheer` and `worried`. The generated
pictures are in `art/source/host/`. `tools/cut-art.py host` cuts them out
with one shared frame and writes the sprites in this folder.

## idle

Model: Z-Image Turbo (`mcp-tools/Z-Image-Turbo` on Hugging Face),
1024 x 1024, seed 21, 8 steps.

> A cute chubby chibi capybara mascot with a small orange yuzu fruit with
> one green leaf balanced on top of its head. Big round head, small round
> ears, big blocky capybara snout with a dark nose, tiny chubby body,
> stubby arms and legs, warm golden-brown fur, pink blush cheeks, big
> glossy dark eyes, calm happy smile. Sitting upright, facing the camera,
> arms resting at its sides. Single isolated game character for a casual
> mobile puzzle game, front view, stylized 3D cartoon render, soft
> clay-like rounded chunky shapes, very vivid saturated candy colors, soft
> warm light from the upper left, centered, the whole character visible
> with empty space around it, plain flat white background, no ground, no
> shadow, no text.

## cheer and worried

These are edits of the idle picture, so the character stays the same.
Model: FLUX.1 Kontext Dev (`mcp-tools/FLUX.1-Kontext-Dev`), seed 5,
guidance 2.5, 20 steps. To add a pose, edit `art/source/host/idle.webp`
with a prompt of the same form.

cheer:

> The same capybara character cheering with joy: both short arms raised
> high above its shoulders, eyes closed in happy curved arcs, big open
> smiling mouth. Keep the same character design, colors, 3D clay style,
> the orange on its head, the sitting position, and the plain white
> background.

worried:

> The same capybara character looking worried and nervous: sad slanted
> eyebrows, wide eyes, a small wavy frown, both paws held up to its
> cheeks, one blue sweat drop on its forehead. Keep the same character
> design, colors, 3D clay style, the orange on its head, the sitting
> position, and the plain white background.
