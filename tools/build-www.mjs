// Copy the files that the game needs at run time into www/, for the
// native app (Capacitor copies www/ into the iOS project). The web version
// does not use this: it is served from the repo root.
//
//   node tools/build-www.mjs

import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = `${ROOT}www/`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const name of ['index.html', 'styles.css', 'manifest.webmanifest', 'src', 'fonts', 'icons', 'art']) {
  cpSync(ROOT + name, OUT + name, {
    recursive: true,
    // Not the generated source pictures (large, not used in the game),
    // the prompt notes or macOS folder files.
    filter: (path) => !/\/art\/source(\/|$)/.test(path) && !/PROMPTS\.md$|\.DS_Store$/.test(path),
  });
}
console.log('wrote www/');
