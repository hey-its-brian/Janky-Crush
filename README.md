# Janky Crush

A private match-3 game for iPhone, built as a web app you add to your home
screen. No real-money purchases, no ads, no accounts, no tracking: the game
makes no network requests beyond loading its own files, and everything is
saved on the phone.

Coins are earned in the game only: from wins, new stars, leftover moves and
a daily bonus. They buy boosters, +5 moves and life refills.

Built for the iPhone 17 Pro Max. See [TODO.md](TODO.md) for the roadmap.

## Play it on your iPhone

The game is plain HTML, CSS and JavaScript with no build step. Any static
file host works.

### Quick test from your Mac (same Wi-Fi)

```sh
cd janky-crush
python3 -m http.server 8000
```

Find your Mac's IP (System Settings › Wi-Fi › Details, or
`ipconfig getifaddr en0`), then on the iPhone open Safari to
`http://<mac-ip>:8000`. Tap **Share › Add to Home Screen** to get a
full-screen icon.

Over plain `http` the game runs fine but can't work offline, because iOS
only allows offline caching on `https` sites.

### Permanent install (works offline)

Host the repo on any static `https` host. It's a private repo, so:

- **Cloudflare Pages** or **Netlify**: free, connect the repo, no build
  command, output directory `/`.
- **GitHub Pages**: needs a paid GitHub plan for private repos.

Open the URL in Safari on the iPhone and **Add to Home Screen**. After the
first launch it works with no connection.

## Develop

```sh
npm test          # engine tests (Node 20+)
npm run serve     # http://localhost:8000
node tools/tune.mjs           # re-tune every level's moves and stars
node tools/tune.mjs 7 12      # ...or just some levels
node tools/make-icons.mjs     # regenerate home-screen icons (needs Playwright)
```

### Levels

Level layouts, goals and candy colors are designed by hand in
`src/levels.js`. Each level's moves (jelly and ingredient levels) and star
scores come from `src/level-tuning.js`, which `tools/tune.mjs` writes: a
computer player that judges moves the way a person can (the match, the
specials, the jelly, how far ingredients drop, but not cascades it can't
see) plays every level 200 times, and the numbers are set so its win rate
falls from 99% on level 1 to about 58% on level 30. After changing a
level, re-run the tuner for it.

When you add or rename a file, add it to the `ASSETS` list in `sw.js` and
bump `VERSION`, or the installed app keeps serving the old copy.

## Layout

| Path | What it is |
| --- | --- |
| `src/engine/board.js` | Pure board logic: matching, specials, jelly, ingredients, gravity, refill, shuffle. Tested in `test/`. |
| `src/engine/level.js` | Level setup from a layout, and goal tracking. |
| `src/engine/turn.js` | A turn, a booster (Smash, Switch) and the end-of-level bonus, as sequences of events. |
| `src/save.js` | The Normal and Easy save files: levels, coins, boosters, lives and the daily bonus, plus the coin prices and payouts. Tested in `test/save.test.js`. |
| `src/settings.js` | Sound, music, announcer voice and haptics switches. |
| `src/audio/` | Synthesized sound effects and instruments, the music, the announcer voice, and haptic taps. |
| `src/art/` | All the art, drawn as SVG in code: fruits and specials, the capybara host, scenery, coin, heart and booster icons. |
| `src/render/sprites.js` | Turns the piece art into canvas sprites for the board. |
| `src/render/renderer.js` | Canvas drawing and animations. |
| `src/game.js` | Plays a level: runs each turn's events through the renderer, touch input, boosters, and asking for +5 moves. |
| `src/main.js` | Screens: start screen, map bar, shop, lives, dialogs, HUD, the host's reactions. |
| `src/ui/` | The level map and the animated hot-spring scene. |
| `src/levels.js`, `src/level-tuning.js` | Level designs, and their tuned moves and stars. |
| `tools/tune.mjs` | The level tuner. |
| `styles.css` | Capybara Hot Springs theme and layout. |
| `preview/` | Look-and-feel mockup, art sheet, and `sounds.html` (renders every sound to WAV). Not part of the game. |
| `sw.js`, `manifest.webmanifest` | Offline support and home-screen install. |

The Lilita One and Fredoka fonts are bundled under the SIL Open Font
License (`fonts/OFL-*.txt`). Chakra Petch (`fonts/OFL.txt`) is kept for the
Night Arcade theme.
