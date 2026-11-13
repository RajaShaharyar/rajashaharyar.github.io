/**
 * A venture page's header card (VentureLayout → DeckCard in [data-live-card]): the same live animation
 * as on the homepage deck, playing on its own. It is the page's only autoplaying animation. It runs
 * from beat 1 once on screen, loops after its hold, and pauses off-screen, in a hidden tab or with its
 * pause button. Reduced motion and no JavaScript: the card's final frame, static (nothing runs here
 * but loading what that frame needs). No libraries.
 */
import { playerFor, prepareCards } from './card-player';

export function initVentureCard() {
  const root = document.querySelector<HTMLElement>('[data-live-card]');
  const card = root?.querySelector<HTMLElement>('[data-card]');
  if (!root || !card) return;
  prepareCards(root);
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const toggle = root.querySelector<HTMLButtonElement>('[data-card-toggle]');
  const player = playerFor(card);
  let t = 0;
  let last = 0;
  let raf = 0;
  let paused = false;
  let onScreen = false;
  let started = false;

  const running = () => !paused && onScreen && !document.hidden;
  const loop = (now: number) => {
    raf = 0;
    if (!running()) return;
    const dt = last ? Math.min(100, now - last) : 0;
    last = now;
    if (!player.ready || player.ready()) {
      t += dt;
      if (t >= player.cycle) {
        t = 0;
        player.start();
      }
      player.tick(t);
    }
    raf = requestAnimationFrame(loop);
  };
  const wake = () => {
    if (!raf && running()) {
      if (!started) {
        started = true;
        player.start();
        player.tick(0);
      }
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  };

  // First frame straight away (the SVG scenes' CSS animations wait, armed, until it plays).
  player.first();
  player.tick(0);
  root.classList.add('is-live');
  if (toggle) toggle.hidden = false;

  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    if (!onScreen) player.pause();
    else if (!paused) player.resume();
    wake();
  }).observe(root);
  document.addEventListener('visibilitychange', wake);

  toggle?.addEventListener('click', () => {
    paused = !paused;
    toggle.setAttribute('aria-label', paused ? toggle.dataset.play! : toggle.dataset.pause!);
    toggle.toggleAttribute('data-paused', paused);
    if (paused) player.pause();
    else player.resume();
    wake();
  });

  // For tests: the clock, and seeking it (the live boards render any time).
  Object.assign(root, {
    card: {
      get elapsed() {
        return t;
      },
      get paused() {
        return paused;
      },
      seek(time: number) {
        t = time;
        player.tick(time);
      },
    },
  });
}
