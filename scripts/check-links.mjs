/**
 * Link and output check for the built site.
 *
 *   npm run build && npm run check:links
 *
 * Fails (exit 1) when, in dist/:
 *   - an internal link points to a page or file that doesn't exist,
 *   - a #anchor doesn't exist on its target page,
 *   - an <img> has no alt (decorative images must be aria-hidden),
 *   - visible text contains "TODO", "Coming soon", "being written", "undefined" or "NaN",
 *   - a JSON-LD block doesn't parse,
 *   - a redirect stub (Astro's meta-refresh page for an old address) points at a page or
 *     #anchor that doesn't exist, or at another redirect (no chains).
 * Then requests every external link once and lists the ones that fail. External
 * failures are reported but never fail the run: many sites answer bots with 403/429.
 * Pass --no-external to skip the network part.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const SITE = 'https://rajashaharyar.github.io';
const checkExternal = !process.argv.includes('--no-external');

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const urlOf = (file) => '/' + relative(DIST, file).split(sep).join('/').replace(/index\.html$/, '');
const pages = walk(DIST).filter((f) => f.endsWith('.html'));

const ids = new Map();
for (const f of pages) ids.set(urlOf(f), new Set([...readFileSync(f, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));

const problems = [];
const external = new Map(); // url -> first page that links it
let internalLinks = 0;
let anchors = 0;
let images = 0;
let jsonLd = 0;
const redirects = [];
const isRedirect = (key) => {
  const file = join(DIST, key, 'index.html');
  return existsSync(file) && /http-equiv="refresh"/.test(readFileSync(file, 'utf8'));
};
const forbidden = ['TODO', 'Coming soon', 'being written', 'undefined', 'NaN'];

for (const f of pages) {
  const html = readFileSync(f, 'utf8');
  const page = urlOf(f);
  const refresh = html.match(/http-equiv="refresh" content="\d+;url=([^"]+)"/);
  if (refresh) {
    // Redirect stub: its target page and anchor must exist, and must not be another redirect.
    const target = refresh[1].replace(SITE, '');
    const [path, hash] = target.split('#');
    const key = path.endsWith('/') ? path : `${path}/`;
    redirects.push(`${page} → ${target}`);
    if (!ids.has(key)) problems.push(`${page}: redirects to missing page ${target}`);
    else if (isRedirect(key)) problems.push(`${page}: redirects to another redirect (${target})`);
    else if (hash && !ids.get(key)?.has(decodeURIComponent(hash))) problems.push(`${page}: redirects to missing anchor ${target}`);
    continue;
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  for (const bad of forbidden) if (new RegExp(`\\b${bad}\\b`).test(text)) problems.push(`${page}: visible text contains "${bad}"`);

  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    images++;
    if (!/\salt=/.test(m[0]) && !/aria-hidden="true"/.test(m[0])) problems.push(`${page}: <img> without alt: ${m[0].slice(0, 90)}`);
  }

  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    jsonLd++;
    try {
      JSON.parse(m[1]);
    } catch (e) {
      problems.push(`${page}: JSON-LD doesn't parse (${e.message})`);
    }
  }

  for (const m of html.matchAll(/<a\b[^>]*?\shref="([^"]+)"/g)) {
    let href = m[1].replace(/&amp;/g, '&');
    if (/^(mailto:|tel:)/.test(href)) continue;
    if (/^https?:/.test(href) && !href.startsWith(SITE)) {
      if (!external.has(href)) external.set(href, page);
      continue;
    }
    href = href.replace(SITE, '');
    internalLinks++;
    const [pathAndQuery, hash] = href.split('#');
    const path = pathAndQuery.split('?')[0] || page;
    let key = path;
    let exists;
    if (/\.[a-z0-9]+$/i.test(path)) exists = existsSync(join(DIST, path));
    else {
      key = path.endsWith('/') ? path : `${path}/`;
      exists = ids.has(key);
    }
    if (!exists) {
      problems.push(`${page}: link to missing page ${href}`);
      continue;
    }
    if (hash) {
      anchors++;
      if (!ids.get(key)?.has(decodeURIComponent(hash))) problems.push(`${page}: anchor #${hash} missing on ${key}`);
    }
  }
}

console.log(`${pages.length - redirects.length} pages: ${internalLinks} internal links (${anchors} with anchors), ${images} images, ${jsonLd} JSON-LD blocks`);
console.log(`${redirects.length} redirects:`);
for (const r of redirects) console.log(`  ${r}`);
console.log(problems.length ? problems.map((p) => `✗ ${p}`).join('\n') : '✓ No internal problems');

if (checkExternal) {
  console.log(`\nChecking ${external.size} external links…`);
  const results = await Promise.all(
    [...external].map(async ([url, page]) => {
      try {
        const res = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(20000),
          headers: { 'User-Agent': 'Mozilla/5.0 (link check for rajashaharyar.github.io)', Accept: 'text/html,application/pdf,*/*' },
        });
        return { url, page, status: res.status };
      } catch (e) {
        return { url, page, status: 0, error: e.cause?.code ?? e.name };
      }
    }),
  );
  for (const r of results.sort((a, b) => a.url.localeCompare(b.url))) {
    const ok = r.status >= 200 && r.status < 400;
    const botBlock = [401, 403, 429, 999].includes(r.status);
    console.log(`${ok ? '✓' : botBlock ? '!' : '✗'} ${r.status || r.error}  ${r.url}${ok ? '' : `  (linked from ${r.page})`}`);
  }
  const broken = results.filter((r) => !(r.status >= 200 && r.status < 400) && ![401, 403, 429, 999].includes(r.status));
  if (broken.length) console.log(`\n${broken.length} external link(s) failed (reported only; check them by hand).`);
}

process.exit(problems.length ? 1 : 0);
