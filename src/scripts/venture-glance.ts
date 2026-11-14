/**
 * The venture pages' "At a glance" card (VentureLayout.astro, from 1280 px): shown once the snapshot has scrolled
 * away, hidden while a wide piece (a table, the journey, the results grid, the gallery: [data-wide], and the
 * stage line) passes under it, and hidden once the closing CTA panel comes into view. While hidden it is inert
 * (out of the tab order and the accessibility tree). Positions come from IntersectionObservers only.
 */
export function initVentureGlance() {
  const glance = document.querySelector<HTMLElement>('[data-glance]');
  const snapshot = document.getElementById('snapshot');
  // the closing CTA's section (its panel sits inside a deferred-render section, so observe the section itself)
  const cta = document.querySelector<HTMLElement>('section.cta');
  if (!glance || !snapshot) return;
  const wide = Array.from(document.querySelectorAll<HTMLElement>('.venture-body [data-wide], .venture-body .stages > :first-child'));
  const wideIn = new Set<Element>();
  let snapshotIn = true;
  let ctaIn = false;
  const update = () => {
    const show = !snapshotIn && !ctaIn && wideIn.size === 0;
    glance.toggleAttribute('data-shown', show);
    glance.inert = !show;
  };
  // the snapshot counts as gone once it is under the sticky site header (about 4.5rem)
  new IntersectionObserver(
    (e) => {
      snapshotIn = e[0].isIntersecting;
      update();
    },
    { rootMargin: '-80px 0px 0px 0px' },
  ).observe(snapshot);
  if (cta)
    new IntersectionObserver((e) => {
      ctaIn = e[0].isIntersecting;
      update();
    }).observe(cta);
  // The band the card occupies on screen: from its sticky top down by its height (plus a little air)
  let io: IntersectionObserver | undefined;
  const watchWide = () => {
    io?.disconnect();
    wideIn.clear();
    const top = parseFloat(getComputedStyle(glance).top) || 112;
    const h = glance.offsetHeight || 320;
    const bottom = Math.max(0, innerHeight - top - h - 16);
    io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) wideIn.add(en.target);
          else wideIn.delete(en.target);
        }
        update();
      },
      { rootMargin: `-${Math.max(0, Math.round(top - 16))}px 0px -${Math.round(bottom)}px 0px` },
    );
    wide.forEach((el) => io!.observe(el));
  };
  const desktop = matchMedia('(width >= 80rem)');
  const start = () => {
    if (desktop.matches) watchWide();
    else io?.disconnect();
  };
  start();
  desktop.addEventListener('change', start);
  let t = 0;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = window.setTimeout(start, 200);
  });
}
