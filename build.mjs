/**
 * Build script — inlines CSS, app JS and the PDF vendor libraries into one
 * standalone, fully offline HTML file.
 *
 *   node build.mjs   ->  dist/cashtracker.html
 */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const p = (...s) => resolve(root, ...s);

const read = (f) => readFile(p(f), 'utf8');

/** Guard against a placeholder appearing inside the inlined code. */
function safeInline(code, marker) {
  if (code.includes(marker)) {
    throw new Error(`Inlined code contains the marker ${marker} — change the marker in src/index.html`);
  }
  return code;
}

const html = await read('src/index.html');
const css = await read('src/styles.css');
const app = await read('src/app.js');
const jspdf = await read('node_modules/jspdf/dist/jspdf.umd.min.js');
const autotable = await read('node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js');

const out = html
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JSPDF__*/', () => safeInline(jspdf, '/*__JSPDF__*/'))
  .replace('/*__AUTOTABLE__*/', () => safeInline(autotable, '/*__AUTOTABLE__*/'))
  .replace('/*__APP__*/', () => safeInline(app, '/*__APP__*/'));

for (const marker of ['/*__CSS__*/', '/*__JSPDF__*/', '/*__AUTOTABLE__*/', '/*__APP__*/']) {
  if (out.includes(marker)) throw new Error(`Marker ${marker} was not replaced`);
}

await mkdir(p('dist'), { recursive: true });
await writeFile(p('dist/cashtracker.html'), out, 'utf8');
await copyFile(p('dist/cashtracker.html'), p('cashtracker.html'));

// Capacitor web assets (www/index.html) – same file, ready for `cap sync`
await mkdir(p('www'), { recursive: true });
await writeFile(p('www/index.html'), out, 'utf8');

const kb = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1);
console.log(`✔ dist/cashtracker.html  (${kb} KB)  — single file, works offline`);
console.log(`✔ www/index.html        (${kb} KB)  — Capacitor web assets`);
