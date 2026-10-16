/* Builds the raster icons and the social share image in public/ from the brand mark (public/logo.svg).
 * Run with: node scripts/make-icons.mjs   (uses the Chromium that Playwright already installs; commit the output). */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pub = (f) => fileURLToPath(new URL(`../public/${f}`, import.meta.url));
// public/logo.svg is the mark on a transparent 2000 × 2000 canvas with generous margins; crop to the mark itself so
// the tiles below control the spacing.
const mark = readFileSync(pub('logo.svg'), 'utf8')
  .replace(/<\?xml[^>]*>/, '')
  .replace(/viewBox="[^"]*"/, 'viewBox="340 320 1320 1360"')
  .replace(/ width="\d+" height="\d+"/, '');
const markSvg = (size, fill = '#fff') =>
  mark.replace('<svg ', `<svg width="${size}" height="${size}" `).replaceAll('fill="white"', `fill="${fill}"`);

/** A black square with the mark centred. `pad` is the share of the side kept empty around the mark (maskable icons
 *  keep their content inside the central 80%). `round` is the corner radius share (browser tab icons only). */
const square = (px, pad, round = 0) => `
<body style="margin:0;background:transparent">
  <div style="width:${px}px;height:${px}px;background:#000;border-radius:${px * round}px;display:grid;place-items:center">
    ${markSvg(Math.round(px * (1 - pad * 2)))}
  </div>
</body>`;

const share = `
<body style="margin:0">
  <div style="width:1200px;height:630px;background:#000;color:#fff;display:flex;align-items:center;gap:64px;padding:0 96px;box-sizing:border-box;font-family:system-ui,'Segoe UI',Roboto,sans-serif">
    <div style="flex:none;width:220px;height:220px;border:6px solid #fff;border-radius:56px;display:grid;place-items:center">
      ${markSvg(116)}
    </div>
    <div>
      <div style="font-size:92px;font-weight:800;letter-spacing:.22em;line-height:1">AVORA</div>
      <div style="margin-top:10px;font-size:34px;font-weight:700;letter-spacing:.34em;color:#c7c7c7">BOOKINGS</div>
      <div style="margin-top:44px;font-size:44px;font-weight:700;line-height:1.2">The best booking platform<br>in Somalia</div>
      <div style="margin-top:18px;font-size:30px;color:#c7c7c7">Book your stay with confidence</div>
    </div>
  </div>
</body>`;

/** PNG-in-ICO: one 48px image (modern browsers read it; the .svg is preferred where supported). */
const ico = (png, size) => {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(1, 4); // one image
  head[6] = size;
  head[7] = size;
  head.writeUInt16LE(1, 12); // planes
  head.writeUInt16LE(32, 14); // bits per pixel
  head.writeUInt32LE(png.length, 14 + 4);
  head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png]);
};

const browser = await chromium.launch();
const shot = async (html, w, h, file, transparent = false) => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html);
  const buf = await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  if (file) writeFileSync(pub(file), buf);
  return buf;
};

await shot(share, 1200, 630, 'og-image.png');
await shot(square(180, 0.2), 180, 180, 'apple-touch-icon.png');
await shot(square(192, 0.2, 0.19), 192, 192, 'icon-192.png', true);
await shot(square(512, 0.2, 0.19), 512, 512, 'icon-512.png', true);
await shot(square(512, 0.3), 512, 512, 'icon-maskable-512.png');
writeFileSync(pub('favicon.ico'), ico(await shot(square(48, 0.12, 0.19), 48, 48, null, true), 48));
await browser.close();
console.log('icons written to public/');
