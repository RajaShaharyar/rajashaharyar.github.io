/**
 * Share images: one 1200×630 PNG per page in public/og/.
 *
 *   npm run og        (rerun when a page title or description changes)
 *
 * Builds the site, reads each page's H1 and meta description from dist/, and
 * renders a simple card in Playwright's Chromium: dark background, the accent
 * colour, Raja's name, the page title and one line. Venture pages add their
 * headline metric (site.json → ventures[].metric). Base.astro points og:image
 * at /og/<slug>.png ("home" for /, "ventures-asaanbill" for /ventures/asaanbill/).
 * Each file must stay under 300 KB.
 */
import { build } from 'astro';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MAX_BYTES = 300 * 1024;
const site = JSON.parse(readFileSync('src/content/site.json', 'utf8'));
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const slugFor = (path) => path.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';

const font = (file) => `data:font/woff2;base64,${readFileSync(file).toString('base64')}`;
const inter = font('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');
const bricolage = font('node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2');

console.log('Building the site…');
await build({ root: '.', logLevel: 'warn' });

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pages = walk('dist')
  .filter((f) => f.endsWith('.html'))
  .map((f) => ({ file: f, html: readFileSync(f, 'utf8'), path: '/' + relative('dist', f).split(sep).join('/').replace(/index\.html$/, '').replace(/\.html$/, '/') }))
  .filter((p) => !/http-equiv="refresh"/.test(p.html));

const card = ({ title, line, metric }) => `<!doctype html><html><head><style>
@font-face { font-family: Inter; src: url(${inter}) format('woff2'); font-weight: 100 900; }
@font-face { font-family: Bricolage; src: url(${bricolage}) format('woff2'); font-weight: 200 800; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #0b0c0e; color: #f2f0ea; font-family: Inter, sans-serif; overflow: hidden; }
.frame { position: relative; display: flex; flex-direction: column; height: 100%; padding: 64px 72px 56px; }
.glow { position: absolute; right: -180px; top: -220px; width: 620px; height: 620px; border-radius: 50%; background: radial-gradient(circle, rgba(190,242,100,0.16), rgba(190,242,100,0) 68%); }
.bar { position: absolute; left: 0; top: 0; width: 100%; height: 8px; background: #bef264; }
.name { font-size: 26px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #bef264; }
.title { margin-top: 26px; max-width: 980px; font-family: Bricolage, sans-serif; font-weight: 650; font-size: ${title.length > 34 ? 72 : 88}px; line-height: 1.02; letter-spacing: -0.03em; }
.line { margin-top: 26px; max-width: 900px; font-size: 28px; line-height: 1.4; color: #a9aeb5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.foot { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 40px; }
.metric { display: flex; align-items: baseline; gap: 16px; }
.metric b { font-family: Bricolage, sans-serif; font-size: 76px; font-weight: 650; letter-spacing: -0.03em; color: #bef264; line-height: 1; }
.metric span { font-size: 28px; color: #a9aeb5; }
.domain { font-size: 24px; color: #8c929b; white-space: nowrap; }
.mark { font-family: Bricolage, sans-serif; font-weight: 700; font-size: 30px; color: #f2f0ea; }
.mark i { font-style: normal; color: #bef264; }
</style></head><body><div class="frame"><div class="glow"></div><div class="bar"></div>
<p class="name">${escape(site.name)}</p>
<h1 class="title">${escape(title)}</h1>
${line ? `<p class="line">${escape(line)}</p>` : ''}
<div class="foot">
  ${metric ? `<p class="metric"><b>${escape(metric.value)}</b><span>${escape(metric.label)}</span></p>` : `<p class="mark">${escape(site.shortName)}<i>.</i></p>`}
  <p class="domain">${escape(new URL(site.url).host)}</p>
</div></div></body></html>`;

mkdirSync('public/og', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
let failed = false;
for (const p of pages) {
  // An H1 with a screen-reader version (the homepage's rotating word) uses that text, not the animated copy.
  const h1Html = p.html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
  const h1 = decode(h1Html.match(/<span class="sr-only">([^<]*)<\/span>/)?.[1] ?? h1Html);
  // The CV's H1 is Raja's name, already on the card: use the page title ("CV") instead.
  const pageTitle = decode(p.html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').split(' — ')[0];
  const title = h1 && h1 !== site.name ? h1 : pageTitle || site.name;
  const line = decode(p.html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
  const venture = site.ventures.find((v) => v.href === p.path);
  await page.setContent(card({ title, line, metric: venture?.metric }), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  const out = join('public', 'og', `${slugFor(p.path)}.png`);
  writeFileSync(out, png);
  const kb = Math.round(png.length / 1024);
  if (png.length > MAX_BYTES) failed = true;
  console.log(`${png.length > MAX_BYTES ? '✗' : '✓'} ${out}  ${kb} KB  "${title}"${venture?.metric ? `  + ${venture.metric.value}` : ''}`);
}
await browser.close();
if (failed) {
  console.error('Some share images are over 300 KB.');
  process.exit(1);
}
console.log(`\n${pages.length} share images written. Rebuild (npm run build) to include them in dist/.`);
