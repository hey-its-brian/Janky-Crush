# To-do

## Phases

- [x] **Phase 1: Core engine.** Board, swipe or tap-tap swapping, matching,
      cascades, gravity, refill, auto-shuffle when no moves are left, idle
      hint, score and stars, Night Arcade look, installable on iPhone.
- [x] **Phase 2: Specials and combos.** Striped (match 4, stripes follow
      the swipe), wrapped (L/T shape, explodes twice), color bomb (match 5),
      plus all six special+special combos and chain reactions.
- [x] **Phase 3: Levels 1–30.** Score, jelly (single and double) and
      ingredient goals, a neon level map, level intro and result screens,
      the "Janky Crush!" end-of-level bonus, and progress saved on the
      phone. Moves and star scores are tuned by `tools/tune.mjs`.
- [x] **Phase 3.5: Capybara Hot Springs look.** Fruit pieces, glowing
      specials, glass board over an animated scene, bath foam, duckies and
      pups, the capybara host with callouts, score meter with star marks,
      end-of-level review, a lively map, new app icon.
- [x] **Sound and haptics.** Synthesized effects (pops that climb through a
      chain, zaps, booms, lightning, splashes, quacks, jingles, win and lose
      tunes), a tropical music loop (calmer on the map), haptic taps (iOS 18+
      switch trick, vibration on Android), and Settings switches for each.
- [x] **Island sound pass.** Coconut knocks, marimba and water (bubbles,
      splashes, rushes) for matches and specials, climbing the scale through
      a cascade; soft on top, quieter overall, sitting under the music;
      reverb and left/right placement; a deep announcer voice for the
      callouts (with its own switch); a slow, calm "um-pa-pa" in 3/4 with
      guitar, bass and vibraphone (levels add piano, light drums and
      melodica).
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

- [ ] Theme picker in Settings. A theme changes colors, pieces and the
      background only; gameplay stays the same.
- [ ] **Night Arcade**: the original neon look (dark, glowing hard candy).
      Its candies and styles are in git history before the Hot Springs
      rebuild.
- [ ] **Sugar Paper**: soft, flat pastels, no glow.

## Polish ideas

- [ ] Richer match effects (sparkle trails, screen shake on big combos).
- [ ] Stronger haptics if iOS ever gives web apps a real vibration API.

## Tuning to revisit

- [ ] The host hopping along the map to the next level after a win.

- [ ] Gravity, bounce and jelly wobble feel right for now (constants at
      the top of `src/render/renderer.js`). Re-check once blockers,
      jelly tiles and boosters are in, since busier boards may need it
      lighter or faster.
