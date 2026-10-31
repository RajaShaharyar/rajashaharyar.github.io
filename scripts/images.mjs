/**
 * Copy selected photos from _source/ into public/images/ as web-ready WebP.
 *
 *   npm run images
 *
 * - Finds each file by its EXACT original name anywhere under _source/
 *   (names keep their typos; the asset map in the blueprint lists them all).
 * - Applies EXIF orientation, resizes to max 1600px wide, encodes WebP and
 *   strips ALL metadata (EXIF, GPS, ICC, XMP). Each output is re-read to prove it.
 * - Records width/height in src/content/images.json so every <img> can reserve
 *   its space (no layout shift). Alt text and captions in that file are kept.
 *
 * _source/ is never committed; this script only reads from it.
 * Add later phases' images to the list below.
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SOURCE_DIR = '_source';
const OUT_DIR = 'public/images';
const MANIFEST = 'src/content/images.json';
const MAX_WIDTH = 1600;

/** [exact original file name, output path under public/images (no extension)] */
const IMAGES = [
  // Phase 2: homepage
  ['Invited as guest speaker at NUML University.jpeg', 'speaking/talk-numl-session'],
  ['IMG_1432.JPG', 'recognition/mou-asaanbill-najoomi'],
  ['K2.png', 'recognition/k2prenuer-youngest-startup'],
  ['Won Zinidigi Prize Islamabad Regionals 2023 at Hitec Taxila.jpeg', 'recognition/zindigi-prize-2023'],
  ['Won AIESEC Sparkaton 2023 at TMUC ISB.jpeg', 'recognition/aiesec-sparkathon-2023'],
  ['Won Startup Pitching League _24 at NIC Peshawar.jpeg', 'recognition/startup-pitching-league-2024'],
  ['Top 3 in LMKT Startup Showdown 2023.jpeg', 'recognition/lmkt-showdown-top3-2023'],
  ['Won 1st Prize in best FYP Idea at PGDC 2023.jpeg', 'recognition/pgdc-2023-fyp-first-prize'],
  ['Won ICSTSI Business plan competition.jpeg', 'recognition/icstsi-competition-win'],
  ['Recieving Award from CEO Nayatel.jpeg', 'recognition/award-nayatel-ceo'],
  ['Invited as guest speaker at Air University ISB.jpeg', 'speaking/talk-air-university'],
  ['Invited as guest speaker at NUST EME.jpeg', 'speaking/talk-nust-eme'],
  ['Invited as guest speaker at HITEC University Taxila.jpeg', 'speaking/talk-hitec-hibis-2025'],
  ['Invited to a Podcast.jpeg', 'speaking/podcast-asaanbill'],
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (!existsSync(SOURCE_DIR)) {
  console.error(`No ${SOURCE_DIR}/ folder here. Run this from the project root on a machine that has the source material.`);
  process.exit(1);
}

const allFiles = walk(SOURCE_DIR);
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
let failed = false;

for (const [sourceName, outBase] of IMAGES) {
  const matches = allFiles.filter((p) => p.split(/[\\/]/).pop() === sourceName);
  if (matches.length !== 1) {
    console.error(`✗ ${matches.length} matches for "${sourceName}" (need exactly 1)`);
    failed = true;
    continue;
  }

  const key = `${outBase}.webp`;
  const outPath = join(OUT_DIR, key);
  mkdirSync(dirname(outPath), { recursive: true });

  await sharp(matches[0], { failOn: 'none' })
    .rotate() // bake in EXIF orientation before the metadata is dropped
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 78, effort: 6 })
    .toFile(outPath); // sharp writes no metadata unless asked to

  const meta = await sharp(outPath).metadata();
  const leaked = ['exif', 'icc', 'iptc', 'xmp'].filter((k) => meta[k]);
  if (leaked.length) {
    console.error(`✗ ${key} still has metadata: ${leaked.join(', ')}`);
    failed = true;
  }

  const kb = Math.round(statSync(outPath).size / 1024);
  manifest[key] = {
    width: meta.width,
    height: meta.height,
    alt: manifest[key]?.alt ?? 'TODO: alt text',
    caption: manifest[key]?.caption ?? 'TODO: caption',
    source: sourceName,
  };
  console.log(`✓ ${key}  ${meta.width}×${meta.height}  ${kb} KB  (no metadata)`);
}

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`\nWrote ${MANIFEST} (${Object.keys(sorted).length} images)`);
process.exit(failed ? 1 : 0);
