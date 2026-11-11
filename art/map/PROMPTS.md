# Map sprite prompts

The map sprites were made with the Z-Image Turbo model
(`mcp-tools/Z-Image-Turbo` on Hugging Face), 8 steps. The generated
pictures are in `art/source/map/`. `tools/cut-art.py` cuts them out and
writes the sprites in this folder.

To add a sprite: generate a picture, save it in `art/source/map/`, add its
name to `SPRITES` in the tool, and run the tool.

## The prompt

Each prompt is a subject, then this text:

> Single isolated game asset for a casual mobile puzzle game map,
> three-quarter view from slightly above, stylized 3D cartoon render, soft
> clay-like rounded chunky shapes, very vivid saturated candy colors,
> glossy, soft warm light from the upper left, centered, the whole object
> visible with empty space around it, plain flat white background, no
> ground, no shadow, no text.

For the animals, "game asset" is "game character". For white or gray
subjects (pine, onsen, mountains, cloud), the background is "plain flat
bright magenta background", because a white subject on white is hard to
cut out.

## Subjects

Size is 1024 x 1024 unless the table gives a different size.

| Sprite | Seed | Subject |
|---|---|---|
| hut | 7 | A small cute tropical bamboo hut with a thick golden thatched straw roof, a round wooden door and two little windows |
| beachhut | 7 | A small cute beach tiki hut with a shaggy palm-leaf roof, bamboo walls, a colorful surfboard leaning on it |
| teahouse | 7 | A small cute Japanese tea house with a curved red tiled roof, wooden walls, a paper sliding door and a round glowing paper lantern |
| yuzutree | 7 | A cute round leafy citrus tree full of big orange yuzu fruits, with a short thick brown trunk |
| palm | 7 | A cute tropical coconut palm tree with a curved ringed trunk, big glossy green fronds and three coconuts |
| sakura | 12 | A cute sakura tree in full bloom: a big round puffy crown of pink flowers on a curved dark brown trunk |
| pine | 12 | A cute chunky pine tree with dark green branches covered in thick fluffy white snow, short brown trunk |
| onsen | 12 | A small round hot spring pool ringed with smooth rocks topped with snow, steaming bright turquoise water, a tiny wooden bucket on the edge |
| torch (720 x 1280) | 12 | A tall thin bamboo garden torch with a bright orange and yellow cartoon flame on top, plain bamboo pole with no face |
| lantern (720 x 1280) | 7 | A short wooden post with a glowing round red and orange Japanese paper lantern hanging from its arm |
| rocks | 12 | Three smooth rounded gray stones stacked in a small pile, with a patch of green moss and one tiny pink flower |
| redpanda | 7 | A cute chubby baby red panda sitting and waving one paw, big sparkly eyes, happy smile, fluffy striped tail |
| toucan | 7 | A cute chubby toucan bird with a big orange beak, perched on a short wooden branch |
| turtle | 7 | A cute chubby green sea turtle with a happy face, big sparkly eyes, waving one flipper |
| crab | 7 | A cute chubby red-orange crab with big sparkly eyes, raising both claws happily |
| frog | 7 | A cute chubby bright green frog with big sparkly eyes and a happy smile, sitting on a round green lily pad |
| monkey | 7 | A cute chubby Japanese snow monkey with fluffy beige-brown fur and a pink face, sitting relaxed with a small folded white towel on its head, eyes closed, happy smile (green background) |
| balloon (864 x 1152) | 12 | A cute hot-air balloon with pink, yellow and turquoise vertical stripes and a small wicker basket |
| cloud (1280 x 720) | 12 | A single puffy white cartoon cloud made of soft round lobes |
| mountains (1680 x 720) | 12 | A wide row of three chunky rounded mountain peaks with thick white snow caps and blue-lavender rock, small snowy pine trees at the base |
| flower | 12 | A single cute five-petal flower seen from above, round hot pink petals and a yellow center, no stem |
| tuft | 12 | A small round tuft of bright green grass blades |
| bamboo | 7 | A cute cluster of five tall chunky green bamboo stalks with a few big leaves |
| waterfall | 7 | A small cute waterfall: bright turquoise water falling over a pile of chunky mossy gray rocks into a little round pool, white foam at the bottom |
| panda | 7 | A cute chubby baby giant panda sitting and holding a green bamboo stick, big sparkly eyes, happy smile (magenta background) |
| mushrooms | 7 | A cute cluster of three chunky glowing mushrooms, bright blue and pink caps with white spots, soft glow |
| lanterntree | 7 | A cute round old forest tree with a thick twisted trunk, a dark teal-green leafy crown, and small glowing yellow lanterns hanging from its branches |
| owl | 7 | A cute chubby round purple owl with big sparkly yellow eyes and a happy face, perched on a short wooden branch |
| fireflyjar (720 x 1280) | 7 | A glass jar full of glowing yellow-green fireflies, with a cork lid, standing on a short wooden stump |
| shell | 12 | A cute chunky spiral sea shell, pastel pink and cream |
| starfish | 7 | A cute chubby orange starfish with a happy face, lying flat, seen from above |
| sailboat | 7 | A cute small toy sailboat with a chunky wooden hull and one red and white striped sail (green background, no water) |
| sign | 7 | A wide blank wooden signboard for a game map: one big horizontal plank of warm golden-brown wood with rounded corners and a lighter carved border, completely empty, held up by two short thick wooden posts at its left and right ends. Model: Qwen-Image, 16:9, straight front view. |

The tool makes the orange, white and blue flowers and the snow tuft from
the pink flower and the green tuft.

The model sometimes returns a "maybe not safe" placeholder picture for a
harmless prompt. If that occurs, change the seed or the wording.
