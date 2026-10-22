# Janky Crush

A private match-3 game for iPhone, built as a web app you add to your home
screen. No real-money purchases, no ads, no accounts, no tracking: the game
makes no network requests beyond loading its own files, and everything is
saved on the phone.

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
python3 tools/make-icons.py   # regenerate home-screen icons (needs Pillow)
```

When you add or rename a file, add it to the `ASSETS` list in `sw.js` and
bump `VERSION`, or the installed app keeps serving the old copy.

## Layout

| Path | What it is |
| --- | --- |
| `src/engine/board.js` | Pure board logic: matching, gravity, refill, shuffle. Tested in `test/`. |
| `src/render/sprites.js` | Draws each candy once (glossy hard candy with a neon glow). |
| `src/render/renderer.js` | Canvas drawing and animations. |
| `src/game.js` | Turn loop and touch input. |
| `src/levels.js` | Level definitions. |
| `styles.css` | Night Arcade theme and layout. |
| `sw.js`, `manifest.webmanifest` | Offline support and home-screen install. |

The Chakra Petch font is bundled under the SIL Open Font License
(`fonts/OFL.txt`).
