# Welcome screen prompts

The generated pictures are in `art/source/title/`. `tools/make-title.py`
cuts the logo out of its green background, scales the backdrop, and writes
the two pictures in this folder.

## logo

Model: Qwen-Image (`mcp-tools/Qwen-Image` on Hugging Face), 4:3, seed 7,
16 steps, guidance 4.

> A mobile puzzle game title logo. The words "Yuzu" on the top line and
> "Springs" on the bottom line, in big chunky bubbly 3D cartoon letters,
> slightly tilted and playful. "Yuzu" is glossy white letters with a thick
> hot pink outline. "Springs" is bigger, glossy golden yellow letters with a
> thick orange outline. The letters look like shiny polished candy with
> soft highlights. A small orange yuzu fruit with a green leaf sits on top
> of the letter Y, and a few small fruit pieces (strawberry, blueberry,
> star fruit) are tucked around the letters. Stylized 3D render, very vivid
> saturated colors, soft light from the upper left, centered, plain flat
> bright green background, no ground, no shadow.

Negative prompt: watermark, copyright, blurry, low resolution, extra words,
misspelled text, characters, animals.

## backdrop

Model: Z-Image Turbo (`mcp-tools/Z-Image-Turbo`), 864 x 1536, seed 7,
8 steps. The pool must be in the middle of the picture: the screen puts the
host in it (`.title-stage` in `styles.css`).

> Mobile puzzle game welcome screen background, tall portrait. In the exact
> middle of the picture, a cozy round hot spring pool with turquoise
> steaming water, ringed by smooth mossy rocks, with a small wooden bucket
> and a few floating orange yuzu fruits. The bottom third of the picture is
> only a plain soft green grassy meadow with small flowers. Left and right
> of the pool: yuzu trees with orange fruit, bamboo, pink flowers and a
> paper lantern. Behind the pool, soft rolling green hills and one
> snow-capped mountain. The top third is open calm warm golden morning sky
> with fluffy clouds. Stylized 3D cartoon render, soft painterly shading,
> vibrant saturated colors, gentle depth haze. No characters, no animals,
> no text, no UI.
