/**
 * Favicon/icon generator
 *
 * Renders public/favicon.svg via Playwright to produce:
 *   - public/favicon.ico  (32x32)
 *   - public/icons/icon-192.png
 *   - public/icons/icon-512.png
 *   - public/icons/icon-512-maskable.png (with extra padding)
 *
 * Usage:  npm run gen:icons
 *    or:  node scripts/gen-icons.mjs
 */

import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const svgPath = resolve(__dirname, '../public/favicon.svg');
const iconsDir = resolve(__dirname, '../public/icons');
mkdirSync(iconsDir, { recursive: true });

const svgContent = readFileSync(svgPath, 'utf-8');

// Render SVG at a given size via Playwright
async function renderSvg(browser, size) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: size, height: size });
  // Inline SVG as a data URL page
  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  html, body { width: ${size}px; height: ${size}px; overflow: hidden; }
  img { width: 100%; height: 100%; }
</style></head>
<body><img src="data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}" /></body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  return buf;
}

// Minimal ICO file from a single 32x32 PNG
function pngToIco(pngBuf) {
  const dir = Buffer.alloc(6 + 16);
  dir.writeUInt16LE(0, 0);      // reserved
  dir.writeUInt16LE(1, 2);      // ICO type
  dir.writeUInt16LE(1, 4);      // 1 image
  dir.writeUInt8(32, 6);        // width
  dir.writeUInt8(32, 7);        // height
  dir.writeUInt8(0, 8);         // color palette
  dir.writeUInt8(0, 9);         // reserved
  dir.writeUInt16LE(1, 10);     // color planes
  dir.writeUInt16LE(32, 12);    // bits per pixel
  dir.writeUInt32LE(pngBuf.length, 14); // image size
  dir.writeUInt32LE(22, 18);    // offset to image data
  return Buffer.concat([dir, pngBuf]);
}

// Render maskable icon (extra safe-zone padding)
async function renderMaskable(browser, size) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: size, height: size });
  // Maskable icons need 10% safe zone on each side (80% content area)
  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: #0a0a0f; display: flex; align-items: center; justify-content: center; }
  img { width: 80%; height: 80%; }
</style></head>
<body><img src="data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}" /></body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  return buf;
}

const browser = await chromium.launch();

const [ico32, icon192, icon512, maskable512] = await Promise.all([
  renderSvg(browser, 32),
  renderSvg(browser, 192),
  renderSvg(browser, 512),
  renderMaskable(browser, 512),
]);

await browser.close();

writeFileSync(resolve(__dirname, '../public/favicon.ico'), pngToIco(ico32));
writeFileSync(resolve(iconsDir, 'icon-192.png'), icon192);
writeFileSync(resolve(iconsDir, 'icon-512.png'), icon512);
writeFileSync(resolve(iconsDir, 'icon-512-maskable.png'), maskable512);

console.log('Wrote favicon.ico, icon-192.png, icon-512.png, icon-512-maskable.png');
