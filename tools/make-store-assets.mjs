/**
 * Turns the raw browser captures into the Google Play listing assets.
 *
 *   node tools/make-store-assets.mjs
 *
 * Input : the screenshots captured through tools/shot.html (see the README)
 * Output: store/screenshots/*.png  (720 x 1280, 9:16)
 *         store/feature-graphic-1024x500.png
 *         store/icon-512.png
 */
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => resolve(root, ...s);

const FRAME_W = 720;
const FRAME_H = 1280;

const SHOTS = [
  ['01-dashboard.png', process.env.SHOT_DASHBOARD],
  ['02-transactions.png', process.env.SHOT_TRANSACTIONS],
  ['03-reports.png', process.env.SHOT_REPORTS],
  ['04-add-entry.png', process.env.SHOT_ADD],
  ['05-settings.png', process.env.SHOT_SETTINGS]
];

await mkdir(p('store', 'screenshots'), { recursive: true });

for (const [name, src] of SHOTS) {
  if (!src || !existsSync(src)) {
    console.log('… skip ' + name + ' (no capture)');
    continue;
  }
  const img = sharp(src);
  const meta = await img.metadata();
  const left = 0;
  const top = 0;
  const width = Math.min(FRAME_W, meta.width);
  const height = Math.min(FRAME_H, meta.height);
  await img
    .extract({ left, top, width, height })
    .png({ compressionLevel: 9 })
    .toFile(p('store', 'screenshots', name));
  console.log(`✔ store/screenshots/${name}  (${width}x${height})`);
}

/* ------------------------------------------------------------------ */
/* Feature graphic 1024 x 500                                           */
/* ------------------------------------------------------------------ */

const coinSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30.5" fill="#ef7622"/>
  <circle cx="32" cy="32" r="26.8" fill="none" stroke="#ffffff" stroke-width="2.8"/>
  <rect x="16.5" y="20" width="31" height="24" rx="5.5" fill="#0d0d0d"/>
  <path d="M19.5 23.5h5.6a5.6 5.6 0 0 1-5.6 5.6zM44.5 23.5h-5.6a5.6 5.6 0 0 0 5.6 5.6zM19.5 40.5h5.6a5.6 5.6 0 0 0-5.6-5.6zM44.5 40.5h-5.6a5.6 5.6 0 0 1 5.6-5.6z" fill="#ef7622"/>
  <circle cx="32" cy="32" r="6.2" fill="#ef7622"/>
  <path d="M29.9 29.2l3.2-1.8h2v10h-2.6v-7.2h-2.6z" fill="#0d0d0d"/>
</svg>`;

const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111721"/>
      <stop offset="55%" stop-color="#0d1015"/>
      <stop offset="100%" stop-color="#17110d"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ef7622" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ef7622" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <circle cx="250" cy="250" r="240" fill="url(#glow)"/>
  <g transform="translate(140,130) scale(3.4)">${coinSvg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
  <text x="440" y="238" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="74" font-weight="700" fill="#ffffff">Cash Tracker</text>
  <text x="440" y="292" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="30" fill="#9aa3af">Offline cash &amp; expense tracker</text>
  <text x="440" y="348" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="26" font-weight="600" fill="#ef7622">Fully offline · No accounts · No tracking</text>
  <rect x="440" y="378" width="300" height="52" rx="26" fill="#ef7622"/>
  <text x="590" y="412" text-anchor="middle" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff">Reports · PDF · CSV</text>
</svg>`;

await sharp(Buffer.from(feature)).png({ compressionLevel: 9 })
  .toFile(p('store', 'feature-graphic-1024x500.png'));
console.log('✔ store/feature-graphic-1024x500.png');

/* ------------------------------------------------------------------ */
/* Play icon 512 x 512                                                 */
/* ------------------------------------------------------------------ */

if (existsSync(p('assets', 'pwa', 'icon-512.png'))) {
  await sharp(await readFile(p('assets', 'pwa', 'icon-512.png'))).png({ compressionLevel: 9 })
    .toFile(p('store', 'icon-512.png'));
  console.log('✔ store/icon-512.png');
}

console.log('\n✔ store assets ready');
