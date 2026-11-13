/**
 * The homepage credibility strip (NameStrip.astro). CSS runs the marquee; this adds what CSS can't:
 * - the pause/play button (WCAG 2.2.2; also the control on touch screens);
 * - starting only once the strip comes near the screen, and pausing while it is off-screen;
 * - keyboard focus: the strip pauses with the focused name in view (it moves the paused animation to that
 *   name, and undoes the browser's own scroll of the clipped strip, which would break the loop).
 * Reduced motion: nothing runs; CSS shows a static, wrapped list.
 */
export function initStrip() {
  const strip = document.querySelector<HTMLElement>('[data-strip]');
  if (!strip || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const toggle = strip.querySelector<HTMLButtonElement>('[data-strip-toggle]');
  const track = strip.querySelector<HTMLElement>('[data-strip-track]');
  const viewport = strip.querySelector<HTMLElement>('[data-strip-viewport]');
  if (!toggle || !track || !viewport) return;
  toggle.hidden = false;

  toggle.addEventListener('click', () => {
    const paused = !strip.hasAttribute('data-paused');
    strip.toggleAttribute('data-paused', paused);
    toggle.setAttribute('aria-label', paused ? toggle.dataset.play! : toggle.dataset.pause!);
  });

  // Start running once the strip comes near the screen (its wide animated layer costs nothing at load), and
  // pause whenever it is off-screen.
  new IntersectionObserver(
    (entries, io) => {
      if (!entries[0].isIntersecting) return;
      strip.setAttribute('data-run', '');
      io.disconnect();
    },
    { rootMargin: '25% 0px' },
  ).observe(strip);
  new IntersectionObserver((entries) => strip.toggleAttribute('data-offscreen', !entries[0].isIntersecting)).observe(strip);

  // A name gets keyboard focus: bring it into view by moving the (paused, CSS :focus-within) animation.
  strip.addEventListener('focusin', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLElement>('.strip-name');
    const anim = track.getAnimations()[0];
    if (!link || !anim) return;
    const loop = track.scrollWidth / 2; // one copy's width: the distance of one full loop
    const duration = Number(anim.effect?.getComputedTiming().duration) || 40000;
    // the name's place within the track (both rectangles carry the same transform, so it cancels out)
    const x = link.getBoundingClientRect().left - track.getBoundingClientRect().left;
    const target = Math.max(0, x - (viewport.clientWidth - link.offsetWidth) / 2);
    anim.currentTime = ((target % loop) / loop) * duration;
    requestAnimationFrame(() => (viewport.scrollLeft = 0));
  });
}
