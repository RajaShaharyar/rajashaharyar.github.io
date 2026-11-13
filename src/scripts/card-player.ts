/**
 * What a venture card (DeckCard.astro) needs to play, shared by the homepage deck (deck.ts) and a
 * venture page's header card (venture-card.ts). No libraries.
 * - prepareCards(root): once the card(s) are near, apply the AsaanBill card's display font (so it only
 *   downloads then) and lay out its board's pieces one per frame, in story order; load the TapitCard
 *   images (never on first paint unless the card is already on screen).
 * - playerFor(card): a Player for the card's animation. The live boards (AsaanBill, TapitCard) render
 *   any time t purely; the SVG scenes run CSS animations that are armed and restarted.
 */
import { createBoard } from './asaanbill-board';
import { createTapit } from './tapitcard-board';
import type { Board } from './board-camera';

export interface Player {
  cycle: number;
  first(): void;
  start(): void;
  pause(): void;
  resume(): void;
  tick(t: number): void;
  ready?(): boolean; // false holds the clock at 0 (the AsaanBill board while it is still being laid out)
}

const HOLD = 1500;

function svgPlayer(scene: HTMLElement, duration: number): Player {
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
    first: () => arm(false),
    start: () => arm(true),
    pause: () => scene.removeAttribute('data-playing'),
    resume: () => scene.setAttribute('data-playing', ''),
    tick() {},
  };
}

/** A live board (AsaanBill, TapitCard): render(t) is pure, so the clock is all there is. */
function boardPlayer(b: Board, ready?: () => boolean): Player {
  return { cycle: b.cycle, first: () => b.render(0), start: () => b.render(0), pause() {}, resume() {}, tick: (t) => b.render(t), ready };
}

export function playerFor(card: HTMLElement): Player {
  const ab = card.querySelector<HTMLElement>('[data-ab]');
  if (ab) {
    let filled = false;
    return boardPlayer(createBoard(ab), () => (filled ||= !ab.querySelector('[data-ab-board] > :not([data-shown])')));
  }
  const tc = card.querySelector<HTMLElement>('[data-tc]');
  if (tc) return boardPlayer(createTapit(tc));
  return svgPlayer(card.querySelector<HTMLElement>('.scene')!, Number(card.dataset.duration));
}

/** TapitCard's card images: 700w when the panel is at most 800 device px wide, else 1400w. */
function loadCardImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img[data-tc-src]'));
  if (!imgs.length || imgs[0].src) return;
  const panel = imgs[0].closest<HTMLElement>('.deck-panel') ?? root;
  const w = panel.clientWidth * devicePixelRatio <= 800 ? 700 : 1400;
  for (const im of imgs) im.src = `/media/tapitcard/tapitcard-${im.dataset.tcSrc}-${w}.webp`;
}

/** Fonts, board pieces and images for every card under root, in every motion mode. */
export function prepareCards(root: HTMLElement) {
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
      if (!pieces.length) return;
      const font = document.fonts?.load('800 16px "Plus Jakarta Sans AB"') ?? Promise.resolve();
      Promise.race([font, new Promise((r) => setTimeout(r, 1500))]).then(() => frame(next), () => frame(next));
    },
    { rootMargin: '50% 0px' },
  ).observe(root);
  // The card images: once the card is within one viewport, but never on first paint (so only after
  // the visitor scrolls), or as soon as it is actually on screen.
  const images = (margin: string) =>
    new IntersectionObserver(
      (entries, io) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        loadCardImages(root);
      },
      { rootMargin: margin },
    ).observe(root);
  images('0px');
  addEventListener('scroll', () => images('100% 0px'), { once: true, passive: true });
}
