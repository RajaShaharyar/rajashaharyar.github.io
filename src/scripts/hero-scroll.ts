/**
 * The homepage hero's scroll effects (Hero.astro), scrubbed and reversible: with p = how far the hero has
 * scrolled out of view (0 at the top, 1 once it is gone), the giant word drifts left by up to 20vw, the
 * portrait sinks by up to 40px (so it rises slower than the page) and the violet disc scales up to 1.06.
 * Transform only, one write per element per frame, and only while the hero is near the screen.
 * Reduced motion: nothing runs; everything stays static.
 */
export function initHeroScroll() {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
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
    if (word) word.style.transform = `translateX(${(-20 * p).toFixed(3)}vw)`;
    if (portrait) portrait.style.transform = `translateY(${(40 * p).toFixed(2)}px)`;
    if (disc) disc.style.transform = `scale(${(1 + 0.06 * p).toFixed(4)})`;
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    } else {
      removeEventListener('scroll', onScroll);
      onScroll(); // settle on the end state once it has left
    }
  }).observe(hero);
  // For tests: the current progress
  Object.assign(hero, { heroScroll: { get p() { return last; } } });
}
