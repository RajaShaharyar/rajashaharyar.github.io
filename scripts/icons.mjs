/**
 * Make the raster icons from public/favicon.svg (run after changing the SVG):
 *
 *   npm run icons
 *
 * - public/apple-touch-icon.png  180×180, full-bleed square (iOS rounds the corners itself)
 * - public/favicon.ico           32×32 PNG inside an ICO container, for browsers and tools
 *                                that don't read SVG favicons
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8');

// Apple: no rounded corners in the artwork, or iOS would show black corners behind them.
const square = svg.replace(/\srx="[^"]*"/, '');
await sharp(Buffer.from(square), { density: 600 }).resize(180, 180).png().toFile('public/apple-touch-icon.png');

// ICO with one 32×32 PNG image (PNG-in-ICO is supported by every current browser).
const png = await sharp(Buffer.from(svg), { density: 300 }).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); // width
entry.writeUInt8(32, 1); // height
entry.writeUInt8(0, 2); // no palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8); // image size
entry.writeUInt32LE(header.length + entry.length, 12); // image offset
writeFileSync('public/favicon.ico', Buffer.concat([header, entry, png]));

console.log(`✓ public/apple-touch-icon.png (180×180)\n✓ public/favicon.ico (32×32, ${png.length} bytes of PNG)`);
