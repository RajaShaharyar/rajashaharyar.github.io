/**
 * Accessibility check: axe-core on every built page at 390px and 1280px.
 *
 *   npm run build && npm run check:a11y
 *
 * Serves dist/ with Astro's preview server, opens each page in Playwright's
 * Chromium, scrolls through it (so lazy images and scroll reveals settle),
 * then runs axe (WCAG 2.x A/AA rules plus best practices). Exits 1 on any
 * violation. Redirect pages are skipped. Pictures of real product UI skip only
 * the colour-contrast rule (see PICTURES).
 */
import { preview } from 'astro';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const PORT = 4330;
const PICTURES = '[data-ab]';
const WIDTHS = [390, 1280];

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pages = walk('dist')
  .filter((f) => f.endsWith('.html') && !/http-equiv="refresh"/.test(readFileSync(f, 'utf8')))
  .map((f) => '/' + relative('dist', f).split(sep).join('/').replace(/index\.html$/, ''))
  .sort();

const server = await preview({ root: '.', logLevel: 'error', server: { host: '127.0.0.1', port: PORT } });
const browser = await chromium.launch();
let violations = 0;
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    for (const path of pages) {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle' });
      // Below-the-fold sections use content-visibility: auto, which skips rendering them while
      // they are off screen. Render everything so axe can check contrast on the whole page.
      await page.addStyleTag({ content: '*, ::before, ::after { content-visibility: visible !important; }' });
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      // Long enough for the last scroll reveals (500 ms + up to 420 ms stagger) to finish.
      await page.waitForTimeout(1300);
      const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
      const results = await new AxeBuilder({ page }).withTags(tags).exclude(PICTURES).analyze();
      // Pictures of real product UI (the homepage's AsaanBill card: aria-hidden, colours sampled from
      // AsaanBill's screens) get every rule except colour contrast, which WCAG 1.4.3 exempts for text
      // that is part of a picture.
      if (await page.locator(PICTURES).count()) {
        const pictures = await new AxeBuilder({ page }).withTags(tags).include(PICTURES).disableRules(['color-contrast']).analyze();
        results.violations.push(...pictures.violations);
      }
      for (const v of results.violations) {
        violations += v.nodes.length;
        console.log(`✗ ${width}px ${path}  [${v.id}] ${v.help} (${v.nodes.length})`);
        for (const n of v.nodes.slice(0, 3)) console.log(`    ${n.target.join(' ')}`);
      }
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.stop();
}
console.log(`\n${pages.length} pages × ${WIDTHS.length} widths checked with axe: ${violations ? `${violations} violation(s)` : 'no violations'}`);
process.exit(violations ? 1 : 0);
