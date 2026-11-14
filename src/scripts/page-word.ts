/**
 * The inner page headers' giant word (PageWord.astro): it drifts left by up to 6vw as its band scrolls away
 * (p = 0 with the band at the top, 1 once it has gone), scrubbed and reversible. Transform only; it runs only
 * while the band is near the screen and starts after load, when idle; at the top nothing is measured.
 * Reduced motion: nothing runs.
 */
const DRIFT = 6; // vw

export function initPageWord() {
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') idle(start);
  else addEventListener('load', () => idle(start), { once: true });
}

function start() {
  for (const svg of document.querySelectorAll<SVGElement>('[data-page-word]')) {
    const band = svg.closest<HTMLElement>('.page-word-band');
    if (!band || getComputedStyle(svg.parentElement!).display === 'none') continue;
    let raf = 0;
    let last = -1;
    const update = () => {
      raf = 0;
      const r = band.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      if (Math.abs(p - last) < 0.001) return;
      last = p;
      svg.style.transform = `translateX(${(-DRIFT * p).toFixed(3)}vw)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        addEventListener('scroll', onScroll, { passive: true });
        if (scrollY > 0 || last > 0) onScroll(); // at the top and untouched, it is at rest already
      } else {
        removeEventListener('scroll', onScroll);
        onScroll();
      }
    }).observe(band);
  }
}
