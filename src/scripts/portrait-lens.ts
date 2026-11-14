/**
 * The colour lens on a black and white portrait (ShapedPortrait.astro, My story): a 160 px circle follows the
 * cursor and shows the colour version underneath. Only with a fine pointer that can hover, and not with reduced
 * motion. The colour file loads on the first pointer-enter, never before. One style write per frame.
 */
export function initPortraitLens() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  for (const fig of document.querySelectorAll<HTMLElement>('[data-lens]')) {
    const lens = fig.querySelector<HTMLImageElement>('[data-lens-img]');
    if (!lens) continue;
    let rect: DOMRect | null = null;
    let raf = 0;
    let x = 0;
    let y = 0;
    fig.addEventListener('pointerenter', () => {
      if (!lens.getAttribute('srcset')) {
        lens.srcset = lens.dataset.srcset ?? '';
        lens.src = lens.dataset.src ?? '';
      }
      rect = fig.getBoundingClientRect();
      fig.setAttribute('data-lens-on', '');
    });
    fig.addEventListener('pointermove', (e) => {
      rect ??= fig.getBoundingClientRect();
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        lens.style.setProperty('--lx', `${x}px`);
        lens.style.setProperty('--ly', `${y}px`);
      });
    });
    fig.addEventListener('pointerleave', () => {
      rect = null;
      fig.removeAttribute('data-lens-on');
    });
    addEventListener('scroll', () => (rect = null), { passive: true });
  }
}
