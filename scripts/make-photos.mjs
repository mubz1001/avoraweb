/* Builds responsive WebP copies of the placeholder photos in public/placeholder/ (<name>-480.webp, -800.webp,
 * -1200.webp) from <name>.jpg masters, then removes the JPEGs. Run with: node scripts/make-photos.mjs
 * (uses the Chromium that Playwright already installs; commit the output). Only needed while the mock catalogue
 * has placeholder photos; a real backend or image CDN returns its own sizes. */
/* global Image, document -- the resize runs inside the page */
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../public/placeholder/', import.meta.url));
const WIDTHS = [480, 800, 1200];
const jpgs = readdirSync(dir).filter((f) => f.endsWith('.jpg'));
if (!jpgs.length) {
  console.log('No .jpg masters left in public/placeholder; nothing to do.');
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');

for (const file of jpgs) {
  const name = file.replace(/\.jpg$/, '');
  const b64 = readFileSync(dir + file).toString('base64');
  const outputs = await page.evaluate(
    async ({ b64, widths }) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${b64}`;
      await img.decode();
      const out = {};
      for (const w of widths) {
        const h = Math.round((img.naturalHeight * w) / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.8));
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        out[w] = btoa(s);
      }
      return out;
    },
    { b64, widths: WIDTHS },
  );
  for (const w of WIDTHS) writeFileSync(`${dir}${name}-${w}.webp`, Buffer.from(outputs[w], 'base64'));
  unlinkSync(dir + file);
  console.log(`${file} -> ${WIDTHS.map((w) => `${name}-${w}.webp`).join(', ')}`);
}
await browser.close();
