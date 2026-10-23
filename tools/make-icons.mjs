// Draw the home-screen icons: the capybara host cheering on a sunny sky.
// Renders the SVG art in a headless browser and saves PNGs.
//
//   node tools/make-icons.mjs
//
// Needs Playwright with Chromium (PLAYWRIGHT_PATH can point at its
// index.mjs if it isn't installed in this project).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { capy } from '../src/art/capy.js';

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const OUT = fileURLToPath(new URL('../icons/', import.meta.url));

const html = `<!doctype html><html><body style="margin:0">
<div id="icon" style="position:relative;width:512px;height:512px;overflow:hidden;
  background:radial-gradient(circle at 50% 30%, #fff6c8 0, #ffe27a 22%, #7fd8ff 48%, #3fb6f0 100%)">
  <div style="position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 32%,
    rgba(255,255,255,.25) 0 10deg, rgba(255,255,255,0) 10deg 24deg)"></div>
  <div style="position:absolute;left:-10%;right:-10%;bottom:-6%;height:30%;border-radius:50% 50% 0 0;
    background:linear-gradient(#6fe6ea,#21aac2);border-top:10px solid #c4fcff"></div>
  <div style="position:absolute;left:46px;top:60px;width:420px;height:430px">${capy('cheer')}</div>
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
await browser.close();
console.log('wrote icons/icon-512.png, icon-192.png, icon-180.png');
