/**
 * Ambient motion (Phase 17), on every page. No libraries; transform and opacity only.
 * - Aurora (Aurora.astro, variant "drift"): its CSS animation is paused while the band is
 *   off-screen or the tab is hidden. Reduced motion: CSS never starts it.
 * - Spotlight: inside cards marked [data-spotlight], a soft violet glow follows the pointer. Only on
 *   fine pointers that can hover, and not with reduced motion. The glow is a child (.spot) moved by
 *   transform; the card's position is read on the first move (and again after a scroll), not per move.
 */
const motionOk = matchMedia('(prefers-reduced-motion: no-preference)').matches;

function initAurora() {
  const auroras = Array.from(document.querySelectorAll<HTMLElement>('[data-aurora]'));
  if (!auroras.length || !motionOk) return;
  const onScreen = new Map<HTMLElement, boolean>();
  const sync = () => {
    for (const a of auroras) a.toggleAttribute('data-paused', document.hidden || !onScreen.get(a));
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) onScreen.set(e.target as HTMLElement, e.isIntersecting);
    sync();
  });
  auroras.forEach((a) => io.observe(a));
  document.addEventListener('visibilitychange', sync);
}

function initSpotlight() {
  if (!motionOk || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  // Scrolling moves cards under a still pointer: a card reads its position again after a scroll.
  let scrolls = 0;
  addEventListener('scroll', () => scrolls++, { passive: true });
  for (const card of document.querySelectorAll<HTMLElement>('[data-spotlight]')) {
    const spot = document.createElement('span');
    spot.className = 'spot';
    spot.setAttribute('aria-hidden', 'true');
    card.prepend(spot);
    let rect: DOMRect | null = null;
    let seen = -1;
    let raf = 0;
    let x = 0;
    let y = 0;
    card.addEventListener('pointermove', (e) => {
      if (!rect || seen !== scrolls) {
        rect = card.getBoundingClientRect();
        seen = scrolls;
      }
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        spot.style.setProperty('--sx', `${x}px`);
        spot.style.setProperty('--sy', `${y}px`);
      });
    });
    card.addEventListener('pointerleave', () => {
      rect = null;
    });
  }
}

initAurora();
initSpotlight();

export {};
