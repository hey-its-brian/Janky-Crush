# To-do

## Phases

- [x] **Phase 1: Core engine.** Board, swipe or tap-tap swapping, matching,
      cascades, gravity, refill, auto-shuffle when no moves are left, idle
      hint, score and stars, Night Arcade look, installable on iPhone.
- [ ] **Phase 2: Specials and combos.** Striped (match 4), wrapped (L/T
      shape), color bomb (match 5), plus all six special+special combos.
- [ ] **Phase 3: Levels 1–30.** Jelly and ingredient goals, level map, saved
      progress.
- [ ] **Phase 4: Coins, lives and boosters.**
  - Coins earned from stars, level clears, leftover moves and a daily bonus.
  - Spend coins on boosters (Smash, Switch, Shuffle), +5 moves when you run
    out, and early life refills.
  - Lives work like the original: lose one on a failed level, refill on a
    timer.
  - Start screen with two save files: **Normal** and **Easy**. The mode is
    picked when a save starts and can't be changed later. Easy has
    unlimited lives. Each save keeps its own levels, coins and boosters.
- [ ] **Phase 5+: Level packs** of 15–30, each adding a blocker (frosting,
      chocolate, licorice, bombs, portals, conveyors).

## Themes

- [ ] Theme picker in Settings. A theme changes colors, candies and the
      background only; gameplay stays the same.
- [ ] **Sugar Paper**: soft, flat pastels, no glow. The first extra theme.
      Mockup is the "Future theme · Sugar Paper" board on the design canvas.
- [ ] Keep all theme colors in CSS variables (`styles.css`) and the candy
      palette (`src/render/sprites.js`) so a theme is one swap.

## Polish ideas

- [ ] Sound effects and music, with separate on/off switches.
- [ ] Richer match effects (sparkle trails, screen shake on big combos).
- [ ] Haptics, if iOS ever exposes them to web apps.
