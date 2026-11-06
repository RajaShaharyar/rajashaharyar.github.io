/**
 * Render the CV page to public/cv.pdf.
 *
 *   npm run cv:pdf
 *
 * 1. Builds the site and serves dist/ locally (Astro's own preview server).
 * 2. Opens /cv/ in Playwright's Chromium with print media and saves A4. The
 *    layout comes from the print stylesheet in src/pages/cv.astro, so the web
 *    CV and the PDF are the same content from the same file (cv.json).
 * 3. Fails if the PDF is longer than 2 pages (counted with pdf-lib), sets the
 *    PDF title and author, and reads the text back (pdf-parse) to prove it is
 *    selectable and that the sections come out in order.
 *
 * Run it after every change to cv.json (or the stats/contact in site.json) and
 * commit public/cv.pdf. One-time setup: npx playwright install chromium
 */
import { build, preview } from 'astro';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = 'public/cv.pdf';
const MAX_PAGES = 2;
const TITLE = 'Raja Shaharyar Ali — CV';
const AUTHOR = 'Raja Shaharyar Ali';
const PORT = 4329;

/** Section headings, in the order they must appear in the PDF (References is web-only). */
const SECTIONS = [
  'Summary',
  'Key numbers',
  'Experience',
  'Other ventures',
  'Education',
  'Programmes and certifications',
  'Honours and awards',
  'Speaking',
  'Partnerships',
  'Skills and tools',
  'Languages',
  'Leadership and volunteering',
];
/** Personal details that must never be in the CV. */
const FORBIDDEN = [/date of birth/i, /\bborn\b/i, /\bgender\b/i, /nationality/i, /marital/i, /home address/i, /\baddress\b/i];

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
};

console.log('Building the site…');
await build({ root: '.', logLevel: 'warn' });

const server = await preview({ root: '.', logLevel: 'warn', server: { host: '127.0.0.1', port: PORT } });
const browser = await chromium.launch();
let pdfBytes;
try {
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });
  await page.goto(`http://127.0.0.1:${PORT}/cv/`, { waitUntil: 'networkidle' });
  pdfBytes = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: false, tagged: true });
} finally {
  await browser.close();
  await server.stop();
}

// Page count and metadata
const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
const pages = doc.getPageCount();
doc.setTitle(TITLE, { showInWindowTitleBar: true });
doc.setAuthor(AUTHOR);
doc.setSubject(`CV of ${AUTHOR}`);
doc.setCreator('rajashaharyar.github.io (npm run cv:pdf)');
doc.setLanguage('en-GB');
const finalBytes = await doc.save();

if (pages > MAX_PAGES) {
  const draft = join(tmpdir(), 'cv-too-long.pdf');
  writeFileSync(draft, finalBytes);
  fail(`The CV is ${pages} pages; the limit is ${MAX_PAGES}. Not saved to ${OUT} (draft: ${draft}). Tighten the print styles in src/pages/cv.astro or trim cv.json.`);
  process.exit(1);
}

mkdirSync('public', { recursive: true });
writeFileSync(OUT, finalBytes);

// Selectable text, in order, with no personal details
const parser = new PDFParse({ data: new Uint8Array(finalBytes) });
const { text } = await parser.getText();
await parser.destroy();
const flat = text.replace(/\s+/g, ' ');
const lower = flat.toLowerCase();

let at = lower.indexOf(AUTHOR.toLowerCase());
if (at < 0) fail('The name is not in the PDF text (is the text selectable?)');
for (const heading of SECTIONS) {
  const next = lower.indexOf(heading.toLowerCase(), at + 1);
  if (next < 0) fail(`Section "${heading}" is missing or out of order in the PDF text`);
  else at = next;
}
for (const pattern of FORBIDDEN) if (pattern.test(flat)) fail(`The PDF text matches ${pattern}: personal details must not be in the CV`);
if (/\bTODO\b/.test(flat)) fail('The PDF contains "TODO" text');

const kb = Math.round(finalBytes.length / 1024);
console.log(`${process.exitCode ? '✗' : '✓'} ${OUT}: ${pages} page${pages === 1 ? '' : 's'}, ${kb} KB, ${flat.length} characters of selectable text`);
console.log(`  Title "${TITLE}", author "${AUTHOR}"; sections in order: ${SECTIONS.length}/${SECTIONS.length}`);
