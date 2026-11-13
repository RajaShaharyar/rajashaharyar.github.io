/**
 * "How I grow products" (PlaybookStages.astro): the growth path draws as you scroll, no pinning,
 * fully reversible. p = clamp((0.85 x viewport height - section top) / (0.9 x section height)).
 * The line's four segments (Idea → each card → the arrowhead) draw between the node thresholds, so
 * the line reaches each node as it lights. A card enters (CSS, 500 ms) when its node lights and
 * leaves (250 ms) when p drops 0.04 below its threshold. Focus inside a hidden card reveals it at
 * once. Runs only near the section; passive scroll listener, one update per frame.
 * Reduced motion and no JavaScript: nothing runs; CSS shows the finished path.
 */
const T = [0.08, 0.3, 0.55, 0.8, 1];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function initPlaybook() {
  const root = document.querySelector<HTMLElement>('[data-growth]');
  if (!root || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const section = root.closest('section') ?? root;
  const segs = T.slice(0, 4).map((_, k) => Array.from(root.querySelectorAll<HTMLElement>(`[data-seg="${k}"]`)));
  // the Idea node's holder, then each card (data-lit on these lights the node inside)
  const steps = [root.querySelector<HTMLElement>('.growth-idea')!, ...root.querySelectorAll<HTMLElement>('[data-stage]')];
  const lit = steps.map(() => false);
  let raf = 0;

  const light = (k: number, on: boolean) => {
    lit[k] = on;
    steps[k].toggleAttribute('data-lit', on);
  };
  const update = () => {
    raf = 0;
    const r = section.getBoundingClientRect();
    const p = clamp01((0.85 * innerHeight - r.top) / (0.9 * r.height));
    segs.forEach((els, k) => {
      const v = clamp01((p - T[k]) / (T[k + 1] - T[k])).toFixed(4);
      for (const el of els) el.style.setProperty('--seg', v);
    });
    steps.forEach((el, k) => {
      const on = lit[k] ? p >= T[k] - 0.04 || el.matches(':focus-within') : p >= T[k];
      if (on !== lit[k]) {
        el.removeAttribute('data-instant');
        light(k, on);
      }
    });
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  // Hidden until the section is near (it starts well below the fold); the first update runs then.
  root.classList.add('is-live');
  new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        addEventListener('scroll', onScroll, { passive: true });
        addEventListener('resize', onScroll, { passive: true });
        onScroll();
      } else {
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onScroll);
      }
    },
    { rootMargin: '50% 0px' },
  ).observe(section);

  // A link in a hidden card gets keyboard focus: show that card (and its node) at once.
  steps.forEach((el, k) =>
    el.addEventListener('focusin', () => {
      if (lit[k]) return;
      el.setAttribute('data-instant', '');
      light(k, true);
    }),
  );
}
