/**
 * The homepage hero's rotating word (Hero.astro). One pass: the first word holds, then each word
 * gives way to the next (out: up 0.35em and fade; in: up from 0.35em below, blur 4px → sharp, 450 ms),
 * stopping on the last word. It starts 600 ms after the hero intro and each word shows for about
 * 1.3 s, so the pass ends within 5 s of loading (WCAG 2.2.2 needs no pause button for that).
 * The pass plays again when the hero comes back into view after leaving it, at most once every 10 s.
 * Reduced motion: nothing runs; CSS shows the last word. Without JavaScript the same.
 */
const START_AFTER_INTRO = 600;
const HOLD = 1300;
const SWAP = 450;
const REPLAY_GAP = 10_000;

export function initHeroWord() {
  const rot = document.querySelector<HTMLElement>('[data-hero-rot]');
  if (!rot || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const words = Array.from(rot.children) as HTMLElement[];
  const last = words.length - 1;
  let at = 0;
  let timers: number[] = [];
  let lastStart = 0;
  let running = false;

  const show = (k: number) => {
    const prev = words[at];
    at = k;
    rot.dataset.at = String(k);
    for (const w of words) w.classList.remove('is-in', 'is-out');
    if (prev !== words[k]) {
      prev.classList.add('is-out');
      timers.push(window.setTimeout(() => prev.classList.remove('is-out'), SWAP + 50));
    }
    words[k].classList.add('is-in');
  };

  // One pass from the first word to the last. A replay begins by bringing the first word back.
  const pass = (replay: boolean) => {
    timers.forEach(clearTimeout);
    timers = [];
    running = true;
    lastStart = performance.now();
    let t = 0;
    if (replay) {
      show(0);
      t = SWAP;
    } else {
      rot.dataset.at = '0';
      words[0].classList.add('is-in');
    }
    for (let k = 1; k <= last; k++) {
      t += HOLD;
      const step = k;
      timers.push(window.setTimeout(() => show(step), t));
      t += SWAP;
    }
    timers.push(window.setTimeout(() => (running = false), t));
  };

  // The first pass waits for the hero intro (its fade-in), then START_AFTER_INTRO.
  const intro = rot.closest<HTMLElement>('.hero-intro');
  const introDone = Promise.all((intro?.getAnimations?.() ?? []).map((a) => a.finished.catch(() => undefined)));
  Promise.race([introDone, new Promise((r) => setTimeout(r, 1000))]).then(() =>
    window.setTimeout(() => pass(false), START_AFTER_INTRO),
  );

  // Back into view after leaving it: play again (at most once every 10 s, never over a running pass).
  const hero = rot.closest('section');
  if (!hero) return;
  let left = false;
  new IntersectionObserver((entries) => {
    const visible = entries[0].isIntersecting;
    if (!visible) {
      left = true;
      return;
    }
    if (left && !running && performance.now() - lastStart >= REPLAY_GAP) pass(true);
    left = false;
  }).observe(hero);

  // For tests: the word on screen and whether a pass is running.
  Object.assign(rot, {
    heroWord: {
      get at() {
        return at;
      },
      get running() {
        return running;
      },
    },
  });
}
