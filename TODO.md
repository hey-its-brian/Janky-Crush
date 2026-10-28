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
      guitar, piano, bass, light drums and melodica, on every screen.
      Happy marimba runs when specials go off. iPhone haptics on real taps
      (buttons and the board), since newer iOS blocks haptics from code.
- [x] **Phase 4: Coins, lives and boosters.** Start screen with separate
      Normal and Easy save files (Easy has unlimited lives). Coins from
      wins, new stars, leftover moves and a daily bonus; spent on Smash,
      Switch and Shuffle boosters, +5 moves when you run out, and life
      refills. Lives like the original: five, one back every 30 minutes,
      lost on a failed level or on giving up after a move. Prices and
      payouts are at the top of `src/save.js`.
- [x] **Phase 4.5: Juice and variety.** Faster everything, confetti
      bursts, brighter specials. Coconut blockers (one or two layers;
      pieces slide diagonally around them), collect-the-fruit goals, ten
      new board shapes with the glass cut to the shape, and levels 31–40.
      All 40 levels retuned. A new map: four zones (Yuzu Valley, Coconut
      Cove, Lantern Hills, Steam Peaks) with their own ground, scenery and
      waving critters, gates, a striped rope between levels, a top bar
      with the host's portrait, and the host travelling on after a win.
- [x] **Blockers and dispensers.** Mochi (one or two layers) and gummy
      cubes (they fall; a match beside them or a blast pops them),
      blocker-heavy levels, spouts that drop specials or gummies into a
      column, and a new in-level layout: one pink top panel (moves, score
      bar, goals, the host's portrait) and a booster bar at the bottom.
- [x] **Smoothie blender.** Collect levels are now smoothie recipes: each
      matched fruit flies into a blender in the goal panel, which fills in
      layers and whirls into a smoothie when the recipe is done. Animations
      sped up again.
- [ ] **Phase 5+: Level packs** of 15–30, each adding a mechanic
      (spreading chocolate-like blockers, locked fruit, timer bombs,
      portals, conveyors).
- [ ] **Native iPhone app (not listed in any store)**, once the game is
      feature-complete. Wrap it with Capacitor so the same code runs as a
      real app, and install through TestFlight internal testing (no App
      Review; each build lasts 90 days, so upload a fresh one before then).
      Brings full haptics on matches and explosions, saves that don't
      vanish with the home-screen icon, and a proper app icon and launch
      screen.

## Themes

- [ ] Theme picker in Settings. A theme changes colors, pieces and the
      background only; gameplay stays the same.
- [ ] **Night Arcade**: the original neon look (dark, glowing hard candy).
      Its candies and styles are in git history before the Hot Springs
      rebuild.
- [ ] **Sugar Paper**: soft, flat pastels, no glow.

## Polish ideas

- [ ] Richer match effects (sparkle trails, screen shake on big combos).
- [ ] Full haptics on matches and explosions (comes with the native app).

## Tuning to revisit

- [ ] Coin prices and payouts (top of `src/save.js`): check after some
      real play that coins feel neither tight nor endless.

- [ ] Announcer voice: on hold. Silent on the iPhone home-screen app so
      far; Settings has a Test voice button to check it. Should work in the
      native app.

- [ ] Gravity, bounce and jelly wobble feel right for now (constants at
      the top of `src/render/renderer.js`). Re-check once blockers,
      jelly tiles and boosters are in, since busier boards may need it
      lighter or faster.
