/**
 * Scroll reveal (Phase 10). Styles live in src/styles/global.css.
 *
 * - Targets: every [data-reveal] element and every child of a [data-reveal-stagger] container.
 * - A first IntersectionObserver pass (no forced layout) finds what is on screen at load:
 *   that stays as it is. Only targets off screen are hidden (.reveal-pending), so nothing
 *   visible ever disappears or flickers.
 * - Then each target reveals once, when 15% of it is visible (IntersectionObserver at 0.15) or
 *   when its top passes 85% of the viewport, whichever comes first: 15% of a very tall block
 *   can be a whole screen of blank space, and a deferred block's height is only an estimate
 *   until it renders, so both are watched.
 * - Children of one stagger container that arrive together follow each other 70 ms apart,
 *   capped at 6 steps (420 ms).
 * - [data-reveal-draw] elements are not faded: they get the same classes so their own CSS can
 *   draw something in (the My story timeline rail), over DRAW_MS.
 * - Nothing happens with reduced motion or without IntersectionObserver: content just shows.
 */
const STEP_MS = 70;
const MAX_STEPS = 6;
const DURATION_MS = 500;
const DRAW_MS = 1100;

const motionOk = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

if (motionOk && 'IntersectionObserver' in window) {
  const targets = new Set<Element>(document.querySelectorAll('[data-reveal], [data-reveal-draw]'));
  for (const group of document.querySelectorAll('[data-reveal-stagger]')) {
    for (const child of group.children) targets.add(child);
  }

  const reveal = (el: HTMLElement, delay: number) => {
    if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);
    el.classList.add('is-revealing');
    el.classList.remove('reveal-pending');
    // Drop the reveal transition afterwards, so it never slows later hover effects.
    const duration = el.hasAttribute('data-reveal-draw') ? DRAW_MS : DURATION_MS;
    window.setTimeout(() => {
      el.classList.remove('is-revealing');
      el.style.removeProperty('--reveal-delay');
    }, duration + delay + 50);
  };

  const onEnter = (entries: IntersectionObserverEntry[]) => {
    const arrived = entries
      .filter((e) => e.isIntersecting)
      .map((e) => e.target as HTMLElement)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const steps = new Map<Element, number>();
    for (const el of arrived) {
      if (!el.classList.contains('reveal-pending')) continue; // already revealed by the other observer
      for (const o of observers) o.unobserve(el);
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
  const observers = [normal, tall];

  const first = new IntersectionObserver((entries) => {
    for (const e of entries) {
      first.unobserve(e.target);
      if (e.isIntersecting) continue; // on screen at load: shown at once
      e.target.classList.add('reveal-pending');
      for (const o of observers) o.observe(e.target);
    }
  });
  for (const el of targets) first.observe(el);
}
