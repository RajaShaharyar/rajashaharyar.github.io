/**
 * Scroll reveal (Phase 10). Styles live in src/styles/global.css.
 *
 * - Targets: every [data-reveal] element and every child of a [data-reveal-stagger] container.
 * - A first IntersectionObserver pass (no forced layout) finds what is on screen at load:
 *   that stays as it is. Only targets off screen are hidden (.reveal-pending), so nothing
 *   visible ever disappears or flickers.
 * - Then an observer at 0.15 reveals each target once and stops watching it. Targets taller
 *   than most of the screen reveal when their top passes 85% of the viewport instead
 *   (15% of a very tall block can be a whole screen of blank space).
 * - Children of one stagger container that arrive together follow each other 70 ms apart,
 *   capped at 6 steps (420 ms).
 * - Nothing happens with reduced motion or without IntersectionObserver: content just shows.
 */
const STEP_MS = 70;
const MAX_STEPS = 6;
const DURATION_MS = 500;

const motionOk = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

if (motionOk && 'IntersectionObserver' in window) {
  const targets = new Set<Element>(document.querySelectorAll('[data-reveal]'));
  for (const group of document.querySelectorAll('[data-reveal-stagger]')) {
    for (const child of group.children) targets.add(child);
  }

  const reveal = (el: HTMLElement, delay: number) => {
    if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);
    el.classList.add('is-revealing');
    el.classList.remove('reveal-pending');
    // Drop the reveal transition afterwards, so it never slows later hover effects.
    window.setTimeout(() => {
      el.classList.remove('is-revealing');
      el.style.removeProperty('--reveal-delay');
    }, DURATION_MS + delay + 50);
  };

  const onEnter = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
    const arrived = entries
      .filter((e) => e.isIntersecting)
      .map((e) => e.target as HTMLElement)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const steps = new Map<Element, number>();
    for (const el of arrived) {
      observer.unobserve(el);
      const group = el.parentElement?.hasAttribute('data-reveal-stagger') ? el.parentElement : null;
      let delay = 0;
      if (group) {
        const step = steps.get(group) ?? 0;
        steps.set(group, step + 1);
        delay = Math.min(step, MAX_STEPS) * STEP_MS;
      }
      reveal(el, delay);
    }
  };

  const normal = new IntersectionObserver(onEnter, { threshold: 0.15 });
  const tall = new IntersectionObserver(onEnter, { threshold: 0, rootMargin: '0px 0px -15% 0px' });

  const first = new IntersectionObserver((entries) => {
    const viewport = window.innerHeight;
    for (const e of entries) {
      first.unobserve(e.target);
      if (e.isIntersecting) continue; // on screen at load: shown at once
      e.target.classList.add('reveal-pending');
      (e.boundingClientRect.height > viewport * 0.8 ? tall : normal).observe(e.target);
    }
  });
  for (const el of targets) first.observe(el);
}
