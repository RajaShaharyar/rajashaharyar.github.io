/**
 * Copy selected photos from _source/ into public/images/ as web-ready WebP.
 *
 *   npm run images
 *
 * - Finds each file by its EXACT original name anywhere under _source/
 *   (names keep their typos; the asset map in the blueprint lists them all).
 * - Three kinds of source:
 *     JPEG/PNG     read directly by sharp
 *     HEIC/HEIF    iPhone photos (HEVC), which sharp's bundled libvips can't
 *                  decode: heic-convert decodes them to a lossless PNG first
 *     PDF page     { pdf, page }: the ONE embedded JPEG on that page is
 *                  extracted byte-for-byte (never a screenshot of the slide)
 * - Applies EXIF orientation, resizes to max 1600px wide, encodes WebP and
 *   strips ALL metadata (EXIF, GPS, ICC, XMP). Each output is re-read to prove it.
 * - Also writes 480 and 960 px wide copies (<name>-480.webp, <name>-960.webp) for
 *   srcset, so small slots never download the full file. The unsuffixed file stays
 *   the largest version (max 1600 px), so existing references keep working.
 * - Records width/height in src/content/images.json so every <img> can reserve
 *   its space (no layout shift). Alt text and captions in that file are kept;
 *   new entries get the caption given below (or a TODO to fill in by hand).
 *
 * _source/ is never committed and never written to; this script only reads from it.
 */
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SOURCE_DIR = '_source';
const OUT_DIR = 'public/images';
const MANIFEST = 'src/content/images.json';
const MAX_WIDTH = 1600;
/** Smaller copies for srcset, written as <name>-480.webp and <name>-960.webp (only when narrower than the original). */
const VARIANT_WIDTHS = [480, 960];
const WEBP = { quality: 78, effort: 6 };

const UNWRAPPED = '2024 Unwrapped.pdf';

/**
 * [source, output path under public/images (no extension), caption for a new entry]
 * source is an exact file name, or { pdf: exact file name, page: 1-based page number }.
 */
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

  // Phase 3: About menu
  ['IMG_5304.HEIC', 'education/air-university-convocation'],
  ['Graduate of NIC Peshawar.jpeg', 'recognition/nic-peshawar-graduation-2024'],
  ['Recieving recognition from Registrar.jpeg', 'recognition/award-air-university-registrar'],
  ['Recieving recognition from VC.jpeg', 'recognition/zindigi-win-air-university-vc'],
  ['MOU with Human Care Foundation at NICAT.jpeg', 'recognition/mou-humancare-mustahiq'],

  // Phase 3: "2024 in review", one photo per slide of 2024 Unwrapped (pages 2-12)
  [{ pdf: UNWRAPPED, page: 2 }, 'about/2024-ntu-startupcup', 'Represented MetaBite at NTU StartupCup, Faisalabad'],
  [{ pdf: UNWRAPPED, page: 3 }, 'about/2024-airtech', "Organised AirTech'24 as Director Marketing, Air University"],
  [{ pdf: UNWRAPPED, page: 4 }, 'about/2024-numl-talk', 'Guest speaker on entrepreneurship at NUML, Islamabad'],
  [{ pdf: UNWRAPPED, page: 5 }, 'about/2024-major-contributor-award', 'Major Contributor Award from the Registrar, Air University'],
  [{ pdf: UNWRAPPED, page: 6 }, 'about/2024-tapitcard-office', "Opened TapitCard's office at AUBIC, Islamabad (April 2024)"],
  [{ pdf: UNWRAPPED, page: 7 }, 'about/2024-mustahiq-first-project', "Mustahiq's first project in F-8 Islamabad: providing a livelihood"],
  [{ pdf: UNWRAPPED, page: 8 }, 'about/2024-degree', 'Completed BS Computer Game Development, Air University'],
  [{ pdf: UNWRAPPED, page: 9 }, 'about/2024-k2prenuer-selected', 'Selected for K2prenuer: top 10 of 3,000+ applicants'],
  [{ pdf: UNWRAPPED, page: 10 }, 'about/2024-k2-trek', "Trekked to K2, the world's second-highest mountain, with K2prenuer"],
  [{ pdf: UNWRAPPED, page: 11 }, 'about/2024-asaanbill-start', 'Started working on AsaanBill (November 2024)'],
  [{ pdf: UNWRAPPED, page: 12 }, 'about/2024-k2prenuer-premiere', 'K2prenuer premiere on the big screen'],
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

/** Exactly one file with this exact name under _source/, or null. */
function findSource(name) {
  const matches = allFiles.filter((p) => p.split(/[\\/]/).pop() === name);
  if (matches.length !== 1) {
    console.error(`✗ ${matches.length} matches for "${name}" (need exactly 1)`);
    failed = true;
    return null;
  }
  return matches[0];
}

/** Image XObjects drawn on a page, including those nested in form XObjects. */
function pageImages(doc, resources, seen = new Set()) {
  const xobjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  if (!xobjects) return [];
  return xobjects.entries().flatMap(([, ref]) => {
    const obj = doc.context.lookup(ref);
    if (!(obj instanceof PDFRawStream) || seen.has(obj)) return [];
    seen.add(obj);
    const subtype = obj.dict.get(PDFName.of('Subtype'));
    if (subtype === PDFName.of('Image')) return [obj];
    if (subtype === PDFName.of('Form')) return pageImages(doc, obj.dict.lookupMaybe(PDFName.of('Resources'), PDFDict), seen);
    return [];
  });
}

/** One WebP at the given max width. sharp writes no metadata unless asked to. */
async function encode(input, width, outPath) {
  await sharp(input, { failOn: 'none' })
    .rotate() // bake in EXIF orientation before the metadata is dropped (no-op when there is none)
    .resize({ width, withoutEnlargement: true })
    .webp(WEBP)
    .toFile(outPath);
}

/** Re-read an output and fail if any metadata survived. */
async function verify(outPath, label) {
  const meta = await sharp(outPath).metadata();
  const leaked = ['exif', 'icc', 'iptc', 'xmp'].filter((k) => meta[k]);
  if (leaked.length) {
    console.error(`✗ ${label} still has metadata: ${leaked.join(', ')}`);
    failed = true;
  }
  return meta;
}

const pdfCache = new Map();
/** The single embedded JPEG on a PDF page, as the original bytes. */
async function extractPdfJpeg(path, page) {
  if (!pdfCache.has(path)) pdfCache.set(path, await PDFDocument.load(readFileSync(path), { updateMetadata: false }));
  const doc = pdfCache.get(path);
  const pdfPage = doc.getPages()[page - 1];
  if (!pdfPage) throw new Error(`page ${page} does not exist`);
  const images = pageImages(doc, pdfPage.node.Resources());
  const jpegs = images.filter((img) => String(img.dict.get(PDFName.of('Filter'))) === '/DCTDecode');
  if (images.length !== 1 || jpegs.length !== 1) {
    throw new Error(`page ${page} has ${images.length} images (${jpegs.length} JPEG); expected exactly one JPEG`);
  }
  return Buffer.from(jpegs[0].contents); // DCTDecode streams are complete JPEG files
}

for (const [source, outBase, newCaption] of IMAGES) {
  const isPdf = typeof source === 'object';
  const sourceName = isPdf ? source.pdf : source;
  const sourceLabel = isPdf ? `${source.pdf}, page ${source.page}` : source;
  const path = findSource(sourceName);
  if (!path) continue;

  const key = `${outBase}.webp`;
  const outPath = join(OUT_DIR, key);
  mkdirSync(dirname(outPath), { recursive: true });

  let meta;
  let widths;
  try {
    let input = path;
    if (isPdf) {
      input = await extractPdfJpeg(path, source.page);
    } else if (/\.hei[cf]$/i.test(sourceName)) {
      // heic-convert applies the HEIC's rotation while decoding; PNG keeps it lossless.
      input = await heicConvert({ buffer: readFileSync(path), format: 'PNG' });
    }

    // Largest version first (keeps the plain file name), then the smaller srcset copies.
    await encode(input, MAX_WIDTH, outPath);
    meta = await verify(outPath, key);
    widths = [meta.width];
    for (const w of VARIANT_WIDTHS.filter((w) => w < meta.width)) {
      const variant = join(OUT_DIR, `${outBase}-${w}.webp`);
      await encode(input, w, variant);
      await verify(variant, `${outBase}-${w}.webp`);
      widths.unshift(w);
    }
    widths.sort((a, b) => a - b);
  } catch (error) {
    console.error(`✗ ${key} from "${sourceLabel}": ${error.message}`);
    failed = true;
    continue;
  }

  const kb = Math.round(statSync(outPath).size / 1024);
  manifest[key] = {
    ...manifest[key],
    width: meta.width,
    height: meta.height,
    widths,
    alt: manifest[key]?.alt ?? 'TODO: alt text',
    caption: manifest[key]?.caption ?? newCaption ?? 'TODO: caption',
    source: sourceLabel,
  };
  console.log(`✓ ${key}  ${meta.width}×${meta.height}  ${kb} KB  widths ${widths.join('/')}  (no metadata)`);
}

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`\nWrote ${MANIFEST} (${Object.keys(sorted).length} images)`);
process.exit(failed ? 1 : 0);
