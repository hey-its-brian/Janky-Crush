// Draw the home-screen icons: the capybara host cheering in front of the
// Yuzu Valley backdrop. Composes the art in a headless browser and saves
// PNGs.
//
//   node tools/make-icons.mjs
//
// Needs Playwright with Chromium (PLAYWRIGHT_PATH can point at its
// index.mjs if it isn't installed in this project).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const OUT = fileURLToPath(new URL('../icons/', import.meta.url));
const picture = (path) => `data:image/webp;base64,${readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url))).toString('base64')}`;

// The top of the backdrop (sky, mountain, yuzu trees) fills the icon, with
// a soft glow behind the host so it stands out at small sizes.
const html = `<!doctype html><html><body style="margin:0">
<div id="icon" style="position:relative;width:512px;height:512px;overflow:hidden;background:#59c6ff">
  <img src="${picture('art/scene/zone1.webp')}" style="position:absolute;left:-64px;top:-70px;width:640px">
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 58%, rgba(255,250,214,.85) 0, rgba(255,250,214,.5) 34%, rgba(255,250,214,0) 62%)"></div>
  <img src="${picture('art/host/cheer.webp')}" style="position:absolute;left:-6px;top:20px;width:524px;filter:drop-shadow(0 10px 14px rgba(60,30,0,.35))">
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(html);
const png = await page.locator('#icon').screenshot();
writeFileSync(`${OUT}icon-512.png`, png);
for (const size of [192, 180]) {
  await page.setViewportSize({ width: 512, height: 512 });
  const scaled = await page.evaluate(async ({ data, size }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, size, size);
    return c.toDataURL('image/png').split(',')[1];
  }, { data: png.toString('base64'), size });
  writeFileSync(`${OUT}icon-${size}.png`, Buffer.from(scaled, 'base64'));
}
// The App Store icon for the native app: the same picture at 1024 px.
const big = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 });
await big.setContent(html);
writeFileSync(`${OUT}icon-1024.png`, await big.locator('#icon').screenshot({ omitBackground: false }));
await browser.close();
console.log('wrote icons/icon-1024.png, icon-512.png, icon-192.png, icon-180.png');
