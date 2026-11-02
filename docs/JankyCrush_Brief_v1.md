# Janky Crush: Art Style Sheet

Fill in or change anything in **[brackets]**. Everything else is what the
game uses today, as a starting point. The prompt recipe in section 3 is
built from these answers and used for every image, so the art stays
consistent.

---

## 1. The overall look

| | Choice |
| --- | --- |
| Theme | Capybara hot springs on a tropical island |
| Mood (3 words) | [cozy, juicy, cheerful] |
| Rendering style | [glossy 3D-like cartoon / flat vector / soft clay / painterly] |
| Outlines | [dark brown outline, medium weight / no outline] |
| Shading | [soft gradient, one highlight, gentle shadow underneath] |
| Light direction | Upper left (every image) |
| Proportions | Chibi: big head, small body, about 1:1 head to body |
| Eyes | [big dark eyes with two white sparkles] |
| Camera | Straight-on front view, slight top-down for board pieces |
| Background | Transparent (pieces, characters, props); full scene (zone backgrounds) |
| Feels like | [describe a vibe, not a game: "a sticker sheet", "a toy", "a picture book"] |
| Avoid | [realistic textures, scary faces, thin lines that vanish small, text in images] |

## 2. Palette

| Role | Color | Hex |
| --- | --- | --- |
| Strawberry | Red | `#ff2d4a` |
| Orange | Orange | `#ff9a1f` |
| Lemon | Yellow | `#ffd92e` |
| Apple | Green | `#74d63c` |
| Blueberry | Blue | `#2f86ff` |
| Grapes | Purple | `#9b4dff` |
| UI pink | Pink | `#ff5fa2` |
| UI teal | Teal | `#2ec4d6` |
| Outline / ink | Dark brown | `#5a2d0c` |
| Capybara fur | Warm tan | `#c98a52` |
| Hot spring water | Aqua | `#46d1dc` |
| [extra] | [ ] | [ ] |

Rule: the six fruit colors must be easy to tell apart at a glance, and by
shape alone for colorblind play.

## 3. Prompt recipe

**Style line (added to every prompt):**
> [cute chibi game asset, glossy cartoon style, soft gradient shading,
> dark brown outline, lit from upper left, centered, plain white
> background, high detail, mobile game sprite]

**Avoid line (negative prompt):**
> [text, letters, watermark, realistic photo, blurry, extra limbs,
> cropped, multiple objects, busy background]

| Setting | Drafts | Finals |
| --- | --- | --- |
| Model | FLUX.1 schnell | [FLUX.1 dev] |
| Size | 768×768 | 1024×1024 |
| Steps | 4 | [20–28] |
| Variations per item | 4 | 2 |
| Seed | Random | Fixed seed of the chosen draft |

## 4. Characters

### The host: a capybara

| | |
| --- | --- |
| Name | [ ] |
| Personality | [calm, friendly, a bit smug, loves the hot spring] |
| Signature item | Orange on its head |
| Must keep | Square-ish snout, small round ears, warm tan fur |
| Must avoid | Looking like a bear or a dog |

Poses needed:
- [ ] Idle (gentle smile)
- [ ] Cheer (arms up, eyes closed happy)
- [ ] Worried (low moves)
- [ ] Portrait / head only (top panel and map avatar)
- [ ] [extra: sleeping / soaking in the spring / waving]

### Map critters (one or two per zone)

| Critter | Zone | Personality / prop | Keep? |
| --- | --- | --- | --- |
| Red panda | Yuzu Valley | Waving | [ ] |
| Toucan | Yuzu Valley | On a branch | [ ] |
| Sea turtle | Coconut Cove | Waving a flipper | [ ] |
| Crab | Coconut Cove | Snapping claws | [ ] |
| Frog | Lantern Hills | Holding a lantern | [ ] |
| Snow monkey | Steam Peaks | Soaking, towel on head | [ ] |
| [new] | [ ] | [ ] | [ ] |

## 5. Board pieces

Every piece fits a square, fills about 75% of it, and has a soft shadow
underneath.

| Piece | Look | Notes |
| --- | --- | --- |
| Strawberry | [ ] | Red |
| Orange | [ ] | Orange |
| Lemon | [ ] | Yellow, oval |
| Green apple | [ ] | Green, round with leaf |
| Blueberry | [ ] | Blue, small crown on top |
| Grapes | [ ] | Purple, bunch |
| Striped (each fruit) | Fruit with juice streaks + glow | Stripes show direction (across / up and down) |
| Wrapped (each fruit) | Fruit inside a bubble with a rainbow rim | |
| Color bomb | Dragonfruit with rainbow glow | |
| Rubber duck | Ingredient | |
| Capybara pup | Ingredient | |
| Coconut | 2 layers: rope band; 1 layer: cracked | |
| Mochi | 2 layers: pink swirl; 1 layer: plain | |
| Gummy cube | Lime green, glossy | |
| Bath foam | Blue foam tile | Drawn by the game, not an image |

## 6. Map and backgrounds

| Zone | Ground | Props | Weather / extras |
| --- | --- | --- | --- |
| Yuzu Valley | Green meadow | Huts, orange trees, tiki torches | Butterflies |
| Coconut Cove | Sand | Palms, huts, sea | Waves |
| Lantern Hills | Warm grass | Cherry blossoms, lantern strings | Falling petals |
| Steam Peaks | Snow | Pines, onsen pools, mountains | Snow, steam |
| [new zone] | [ ] | [ ] | [ ] |

Also needed:
- [ ] Level background behind the board (one per zone?) [yes / no]
- [ ] Title screen logo art [keep text logo / illustrated]

## 7. UI icons

| Icon | Look |
| --- | --- |
| Coin | [gold coin with a fruit stamp?] |
| Heart (lives) | Pink glossy heart |
| Smash booster | Wooden tiki mallet |
| Switch booster | Two curved arrows |
| Shuffle booster | Whirlpool |
| Blender | [ ] |

## 8. Technical spec (for me)

- PNG with transparent background, trimmed, centered, square canvas.
- Board pieces: 256×256 export (shown at about 46px; sharp on the Retina screen).
- Characters: 512×512. Backgrounds: 1290×2796 (iPhone 17 Pro Max), compressed.
- Files: `assets/<group>/<name>.png`, e.g. `assets/fruit/strawberry.png`.
- Keep the whole art set under about [5] MB so the app loads fast.

## 9. Sign-off

- [ ] Style direction picked from the draft sheet
- [ ] Host capybara approved
- [ ] Six fruits approved (readable at small size, distinct colors and shapes)
- [ ] Specials and blockers approved
- [ ] Critters and map props approved
- [ ] Final check on the phone
