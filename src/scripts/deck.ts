/**
 * "The work" card deck (VentureDeck.astro). No libraries.
 *
 * Pinned (wide screens, or narrow and at least 640 px tall): each card gets 70svh of scroll;
 * active = clamp(floor(progress x N), 0, N - 1). Switching is time-based (CSS transitions on
 * data-pos), never scrubbed. The rail and keyboard focus on an inactive card's link scroll to it.
 * Autoplay: only the active card runs, from beat 1 when it becomes active, looping after its hold;
 * paused off-screen, in a hidden tab or by the pause button. Others show their first frame.
 * List (narrow and short): each card plays while it is in view.
 * Reduced motion or no JavaScript: CSS shows a plain list in final frames; nothing here runs.
 */
import { createBoard } from './asaanbill-board';

interface Player {
  cycle: number;
  beats: number[];
  first(): void;
  start(): void;
  pause(): void;
  resume(): void;
  tick(t: number): void;
  ready?(): boolean; // false holds the clock at 0 (the AsaanBill board while it is still being laid out)
}

const HOLD = 1500;

function svgPlayer(scene: HTMLElement, beats: number[], duration: number): Player {
  const arm = (play: boolean) => {
    if (scene.hasAttribute('data-armed')) {
      scene.removeAttribute('data-playing');
      scene.removeAttribute('data-armed');
      void scene.offsetWidth; // restart the CSS animations from their first frame
    }
    scene.setAttribute('data-armed', '');
    if (play) scene.setAttribute('data-playing', '');
  };
  return {
    cycle: duration + HOLD,
    beats,
    first: () => arm(false),
    start: () => arm(true),
    pause: () => scene.removeAttribute('data-playing'),
    resume: () => scene.setAttribute('data-playing', ''),
    tick() {},
  };
}

function boardPlayer(el: HTMLElement): Player {
  const b = createBoard(el);
  let filled = false;
  return {
    cycle: b.cycle,
    beats: b.beats,
    first: () => b.render(0),
    start: () => b.render(0),
    pause() {},
    resume() {},
    tick: (t) => b.render(t),
    ready: () => (filled ||= !el.querySelector('[data-ab-board] > :not([data-shown])')),
  };
}

export function initDeck() {
  const root = document.querySelector<HTMLElement>('[data-deck]');
  if (!root) return;
  // Near, in every mode: apply the AsaanBill card's display font (so it only downloads now), then lay
  // out the board's pieces one per frame, in story order (see AsaanBillBoard.astro).
  new IntersectionObserver(
    (entries, io) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      root.setAttribute('data-near', '');
      const pieces = Array.from(root.querySelectorAll<HTMLElement>('[data-ab-board] > *'));
      const frame = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn)); // one piece per frame
      const next = () => {
        pieces.shift()?.setAttribute('data-shown', '');
        if (pieces.length) frame(next);
      };
      const font = document.fonts?.load('800 16px "Plus Jakarta Sans AB"') ?? Promise.resolve();
      Promise.race([font, new Promise((r) => setTimeout(r, 1500))]).then(() => frame(next), () => frame(next));
    },
    { rootMargin: '50% 0px' },
  ).observe(root);
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-card]'));
  const texts = Array.from(root.querySelectorAll<HTMLElement>('[data-card-text]'));
  const rail = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-rail]'));
  const pin = root.querySelector<HTMLElement>('.deck-pin')!;
  const toggle = root.querySelector<HTMLButtonElement>('[data-deck-toggle]')!;
  const N = cards.length;
  const pinned = matchMedia('(width >= 64rem) and (height >= 37.5rem), (width < 64rem) and (height >= 40rem)');
  const steps = texts.map((t) => Array.from(t.querySelectorAll<HTMLElement>('.step')));
  let players: Player[] = [];
  let active = -1;
  let elapsed = 0;
  let last = 0;
  let raf = 0;
  let paused = false;
  let onScreen = false;
  const inView = new Set<number>(); // list mode
  const clocks = new Map<number, number>();

  const syncSteps = (i: number, t: number) => {
    const b = players[i].beats;
    steps[i].forEach((el, k) => {
      const state = t >= (b[k + 1] ?? Infinity) ? 'done' : t >= b[k] ? 'active' : 'upcoming';
      if (el.dataset.state !== state) el.dataset.state = state;
    });
  };

  const running = () => !paused && onScreen && !document.hidden;
  const loop = (now: number) => {
    raf = 0;
    if (!running()) return;
    const dt = last ? Math.min(100, now - last) : 0;
    last = now;
    const ids = pinned.matches ? [active] : [...inView];
    for (const i of ids) {
      if (i < 0) continue;
      const p = players[i];
      if (p.ready && !p.ready()) continue;
      let t = (pinned.matches ? elapsed : clocks.get(i) ?? 0) + dt;
      if (t >= p.cycle) {
        t = 0;
        p.start();
      }
      if (pinned.matches) elapsed = t;
      else clocks.set(i, t);
      p.tick(t);
      syncSteps(i, t);
    }
    raf = requestAnimationFrame(loop);
  };
  const wake = () => {
    if (!raf && running()) {
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  };

  // ---------------------------------------------------------------- pinned: scroll → active card
  const geometry = () => {
    const r = root.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(pin).top) || 0;
    return { start: r.top + scrollY - top, range: Math.max(1, r.height - pin.getBoundingClientRect().height) };
  };
  const indexFromScroll = () => {
    const { start, range } = geometry();
    const p = Math.min(1, Math.max(0, (scrollY - start) / range));
    return Math.min(N - 1, Math.max(0, Math.floor(p * N)));
  };
  const scrollToCard = (i: number, behavior: ScrollBehavior) => {
    const { start, range } = geometry();
    scrollTo({ top: start + ((i + 0.5) / N) * range, behavior });
  };

  const setActive = (i: number) => {
    if (i === active) return;
    const prev = active;
    active = i;
    cards.forEach((c, k) => {
      c.dataset.pos = k === i ? 'active' : k < i ? 'past' : 'future';
      c.style.setProperty('--depth', String(Math.max(0, i - k)));
      c.dataset.depth = String(Math.max(0, i - k));
    });
    texts.forEach((t, k) => t.classList.toggle('is-active', k === i));
    rail.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
    if (prev >= 0) players[prev].first();
    // First activation: cards already passed peek out underneath, so they show their first frame too.
    else players.slice(0, i).forEach((p) => p.first());
    elapsed = 0;
    players[i].start();
    if (paused) players[i].pause();
    players[i].tick(0);
    syncSteps(i, 0);
    wake();
  };

  let scrollRaf = 0;
  const onScroll = () => {
    if (scrollRaf || !pinned.matches) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      setActive(indexFromScroll());
    });
  };

  // ---------------------------------------------------------------- set up when the deck is near
  const setup = () => {
    players = cards.map((c, i) => {
      const board = c.querySelector<HTMLElement>('[data-ab]');
      if (board) return boardPlayer(board);
      const beats = steps[i].map((s) => Number(s.dataset.at));
      return svgPlayer(c.querySelector<HTMLElement>('.scene')!, beats, Number(c.dataset.duration));
    });
    // Cards still to come are off-screen; each is armed when it becomes active (or passed). In the
    // list, every card shows its first frame until it plays.
    players.forEach((_, i) => syncSteps(i, 0));
    if (!pinned.matches) players.forEach((p) => p.first());
    root.classList.add('is-live');
    toggle.hidden = false;
    if (pinned.matches) setActive(indexFromScroll());
    addEventListener('scroll', onScroll, { passive: true });
    pinned.addEventListener('change', () => {
      active = -1;
      if (pinned.matches) setActive(indexFromScroll());
      else players.forEach((p) => p.first());
    });
  };
  new IntersectionObserver(
    (entries, io) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      setup();
    },
    { rootMargin: '50% 0px' },
  ).observe(root);

  // Pause when the deck is off-screen or the tab is hidden.
  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    wake();
  }).observe(root);
  document.addEventListener('visibilitychange', wake);

  // List mode: each card plays while in view.
  const cardView = new IntersectionObserver(
    (entries) => {
      if (pinned.matches || !players.length) return;
      for (const e of entries) {
        const i = cards.indexOf(e.target as HTMLElement);
        if (e.isIntersecting && !inView.has(i)) {
          inView.add(i);
          clocks.set(i, 0);
          players[i].start();
        } else if (!e.isIntersecting && inView.delete(i)) players[i].first();
      }
      wake();
    },
    { threshold: 0.5 },
  );
  cards.forEach((c) => cardView.observe(c));

  // One pause/play toggle for the whole deck.
  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.setAttribute('aria-label', paused ? toggle.dataset.play! : toggle.dataset.pause!);
    if (paused) toggle.setAttribute('data-paused', '');
    else toggle.removeAttribute('data-paused');
    const ids = pinned.matches ? [active] : [...inView];
    for (const i of ids) if (i >= 0) paused ? players[i]?.pause() : players[i]?.resume();
    wake();
  });

  // For tests: the active card, its clock, and seeking it (the AsaanBill card renders any time).
  Object.assign(root, {
    deck: {
      get active() {
        return active;
      },
      get elapsed() {
        return elapsed;
      },
      get paused() {
        return paused;
      },
      seek(t: number) {
        elapsed = t;
        players[active]?.tick(t);
        syncSteps(active, t);
      },
    },
  });

  // The rail, and keyboard focus landing in an inactive card's text, bring that card forward.
  rail.forEach((b, i) => b.addEventListener('click', () => scrollToCard(i, 'smooth')));
  texts.forEach((t, i) =>
    t.addEventListener('focusin', () => {
      if (pinned.matches && i !== active) scrollToCard(i, 'instant');
    }),
  );
}
