/**
 * Rasterizes `app/icon.svg` into every icon size the site serves.
 *
 *   npm run icons
 *
 * The SVG is the single source: browsers that take SVG favicons use it
 * directly, and everything else gets a PNG cut from it here. The outputs are
 * committed, so a build never depends on this script running.
 *
 * - `app/favicon.ico` holds 16, 32 and 48 pixel PNGs. Search engines show the
 *   favicon beside every result and ask for a multiple of 48 pixels.
 * - `app/apple-icon.png` is the 180 pixel home-screen icon for iOS.
 * - `public/icons/` holds the manifest icons and the 512 pixel logo the
 *   organization structured data points at. The mark keeps inside the central
 *   80% safe zone, so the same artwork also serves as the maskable icon.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = await readFile(join(root, "app/icon.svg"));

/** Renders the 32-unit artwork at `size` pixels, rasterizing at that density so edges stay sharp. */
function png(size) {
  return sharp(svg, { density: Math.ceil((72 * size) / 32) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Packs PNG images into an ICO container. Every browser since Vista-era
 * Internet Explorer reads PNG payloads inside an ICO, so no BMP encoding is
 * needed.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

const favicon = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })));
await writeFile(join(root, "app/favicon.ico"), ico(favicon));
await writeFile(join(root, "app/apple-icon.png"), await png(180));

await mkdir(join(root, "public/icons"), { recursive: true });
for (const size of [192, 512]) {
  await writeFile(join(root, `public/icons/icon-${size}.png`), await png(size));
}

console.log("Icons written: app/favicon.ico, app/apple-icon.png, public/icons/icon-{192,512}.png");
