/**
 * The homepage hero's scroll effects (Hero.astro), scrubbed and reversible: with p = how far the hero has
 * scrolled out of view (0 at the top, 1 once it is gone), the giant word drifts left (sideways only) by up to 15vw, the
 * portrait sinks by up to 40px (so it rises slower than the page) and the violet disc scales up to 1.06.
 * Transform only, one write per element per frame, and only while the hero is near the screen.
 * It starts after the page has loaded and painted, when the main thread is idle (Phase 19.1, speed): at the
 * top of the page everything is already at rest, so nothing is measured until the visitor scrolls.
 * Reduced motion: nothing runs; everything stays static.
 */
export function initHeroScroll() {
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') idle(start);
  else addEventListener('load', () => idle(start), { once: true });
}

function start() {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero) return;
  const word = hero.querySelector<SVGElement>('[data-hero-giant]');
  const portrait = hero.querySelector<HTMLElement>('[data-hero-portrait]');
  const disc = hero.querySelector<HTMLElement>('[data-hero-disc]');
  let raf = 0;
  let last = -1;
  const update = () => {
    raf = 0;
    const r = hero.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    if (Math.abs(p - last) < 0.001) return;
    last = p;
    if (word) word.style.transform = `translateX(${(-15 * p).toFixed(3)}vw)`;
    if (portrait) portrait.style.transform = `translateY(${(40 * p).toFixed(2)}px)`;
    if (disc) disc.style.transform = `scale(${(1 + 0.06 * p).toFixed(4)})`;
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      addEventListener('scroll', onScroll, { passive: true });
      if (scrollY > 0 || last > 0) onScroll(); // at the top and untouched, everything is at rest already
    } else {
      removeEventListener('scroll', onScroll);
      onScroll(); // settle on the end state once it has left
    }
  }).observe(hero);
  // For tests: the current progress
  Object.assign(hero, { heroScroll: { get p() { return last; } } });
}
