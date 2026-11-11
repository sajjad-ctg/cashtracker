/**
 * Generates the Android launcher icon + splash screen from the source artwork.
 *
 *   node tools/make-icons.mjs
 *
 * Source: src/cashtracker_icon.png  (orange coin on black, 512x512)
 *
 * Produces:
 *   mipmap-<density>/ic_launcher.png            legacy square icon (API < 26)
 *   mipmap-<density>/ic_launcher_round.png      round icon
 *   mipmap-<density>/ic_launcher_foreground.png adaptive foreground (coin in the 66dp safe zone)
 *   mipmap-<density>/ic_launcher_monochrome.png themed-icon silhouette
 *   drawable/splash.png                        splash screen (coin on the app background)
 */
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const res = resolve(root, 'android/app/src/main/res');
const SRC = resolve(root, 'src/cashtracker_icon.png');

const BACKGROUND = '#0d1015';   // app background
const ICON_BG = '#000000';       // launcher icon background

/* ------------------------------------------------------------------ */
/* 1. locate the coin inside the source artwork                       */
/* ------------------------------------------------------------------ */

const src = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { data, info } = src;
const { width: W, height: H, channels: C } = info;

function isInk(x, y) {
  const i = (y * W + x) * C;
  return data[i] > 18 || data[i + 1] > 18 || data[i + 2] > 18;   // not black
}

// scan the horizontal + vertical centre lines for the coin's extent
let minX = W, maxX = 0, minY = H, maxY = 0;
const cy = Math.floor(H / 2), cx = Math.floor(W / 2);
for (let x = 0; x < W; x++) { if (isInk(x, cy)) { if (x < minX) minX = x; if (x > maxX) maxX = x; } }
for (let y = 0; y < H; y++) { if (isInk(cx, y)) { if (y < minY) minY = y; if (y > maxY) maxY = y; } }
const coinSize = Math.min(maxX - minX + 1, maxY - minY + 1);
const coinLeft = Math.round(cx - coinSize / 2);
const coinTop = Math.round(cy - coinSize / 2);
console.log(`coin: ${coinSize}px  at (${coinLeft}, ${coinTop})`);

/* ------------------------------------------------------------------ */
/* 2. the coin as a circular tile with a transparent outside          */
/* ------------------------------------------------------------------ */

async function coinTile(size) {
  const tile = await sharp(SRC)
    .extract({ left: coinLeft, top: coinTop, width: coinSize, height: coinSize })
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer();

  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
  return sharp(tile).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

// solid silhouette for the themed (monochrome) icon
async function coinSilhouette(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#000"/></svg>`
  );
}

/* ------------------------------------------------------------------ */
/* 3. launcher icons                                                   */
/* ------------------------------------------------------------------ */

// legacy: 48dp, adaptive: 108dp (the coin must sit in the middle 66dp)
const LEGACY = [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]];
const ADAPTIVE = [['mdpi', 108], ['hdpi', 162], ['xhdpi', 216], ['xxhdpi', 324], ['xxxhdpi', 432]];

for (const [density, size] of LEGACY) {
  const dir = resolve(res, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });

  // legacy square = the artwork as it is
  await writeFile(resolve(dir, 'ic_launcher.png'),
    await sharp(SRC).resize(size, size, { fit: 'cover' }).png().toBuffer());

  // round = the coin on transparency
  await writeFile(resolve(dir, 'ic_launcher_round.png'), await coinTile(size));
  console.log(`✔ mipmap-${density} legacy (${size}px)`);
}

for (const [density, canvas] of ADAPTIVE) {
  const dir = resolve(res, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });

  const coinPx = Math.round(canvas * 0.60);          // 60% of 108dp → inside the 66dp safe zone
  const coin = await coinTile(coinPx);
  const left = Math.round((canvas - coinPx) / 2);
  const top = Math.round((canvas - coinPx) / 2);

  const foreground = await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: coin, left, top }])
    .png()
    .toBuffer();
  await writeFile(resolve(dir, 'ic_launcher_foreground.png'), foreground);

  const mono = await sharp(await coinSilhouette(coinPx)).resize(coinPx, coinPx).png().toBuffer();
  const monochrome = await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: mono, left, top }])
    .png()
    .toBuffer();
  await writeFile(resolve(dir, 'ic_launcher_monochrome.png'), monochrome);

  console.log(`✔ mipmap-${density} adaptive (${canvas}px canvas, ${coinPx}px coin)`);
}

// adaptive icon background colour
await writeFile(resolve(res, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ICON_BG}</color>\n</resources>\n`);

/* ------------------------------------------------------------------ */
/* 4. splash screens                                                   */
/* ------------------------------------------------------------------ */

// the system splash screen icon (Android 12+): 288dp canvas, coin in the inner 2/3
{
  for (const [density, dp] of [['mdpi', 288], ['hdpi', 432], ['xhdpi', 576], ['xxhdpi', 864], ['xxxhdpi', 1152]]) {
    const dir = resolve(res, `drawable-${density}`);
    await mkdir(dir, { recursive: true });
    const coinPx = Math.round(dp * 0.56);
    const icon = await sharp({
      create: { width: dp, height: dp, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{
        input: await coinTile(coinPx),
        left: Math.round((dp - coinPx) / 2),
        top: Math.round((dp - coinPx) / 2)
      }])
      .png().toBuffer();
    await writeFile(resolve(dir, 'splash_icon.png'), icon);
    console.log(`✔ drawable-${density}/splash_icon.png (${dp}px)`);
  }
}

const SPLASH = [
  ['drawable', 480, 320], ['drawable-port-mdpi', 320, 480], ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280], ['drawable-port-xxhdpi', 960, 1600], ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-mdpi', 480, 320], ['drawable-land-hdpi', 800, 480], ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960], ['drawable-land-xxxhdpi', 1920, 1280]
];

for (const [folder, w, h] of SPLASH) {
  const dir = resolve(res, folder);
  await mkdir(dir, { recursive: true });
  const logoSize = Math.round(Math.min(w, h) * 0.34);
  const base = await sharp({ create: { width: w, height: h, channels: 4, background: BACKGROUND } }).png().toBuffer();
  const logo = await coinTile(logoSize);
  const out = await sharp(base)
    .composite([{ input: logo, gravity: 'centre' }])
    .png().toBuffer();
  await writeFile(resolve(dir, 'splash.png'), out);
  console.log(`✔ ${folder}/splash.png (${w}x${h})`);
}

/* ------------------------------------------------------------------ */
/* 5. PWA icons (for the GitHub Pages / installable web version)       */
/* ------------------------------------------------------------------ */

for (const size of [192, 512]) {
  const dir = resolve(root, 'assets', 'pwa');
  await mkdir(dir, { recursive: true });
  const coin = await coinTile(Math.round(size * 0.86));
  const icon = await sharp({
    create: { width: size, height: size, channels: 4, background: ICON_BG }
  })
    .composite([{ input: coin, left: Math.round(size * 0.07), top: Math.round(size * 0.07) }])
    .png().toBuffer();
  await writeFile(resolve(dir, `icon-${size}.png`), icon);
  console.log(`✔ assets/pwa/icon-${size}.png`);
}

console.log('✔ icons + splash generated');
