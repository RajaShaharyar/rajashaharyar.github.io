/**
 * The camera shared by the deck's live boards (AsaanBill, TapitCard): a board of rebuilt UI in
 * "board px" sits inside a card's panel, and the camera pans and zooms it to one readable focus
 * area per rest. Rests are [centre x, centre y, scale] in board px, for desktop (d) and phones (p);
 * a rest without a value for the current size is skipped. Moves between rests ease; scale eases
 * in log space. will-change is only on during a move, so text re-rasterises sharp at rest.
 * The loop: hold until holdEnd, then dip to the first frame over (cycle - holdEnd).
 */
export type Cam = [number, number, number];
export interface Rest {
  at: number;
  until: number;
  d?: Cam;
  p?: Cam;
}
export interface Board {
  cycle: number;
  beats: number[];
  render(t: number): void;
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function createCamera(root: HTMLElement, board: HTMLElement, rests: Rest[], holdEnd: number, cycle: number) {
  let w = 0;
  let h = 0;
  let phone = false;
  const measure = () => {
    w = root.clientWidth;
    h = root.clientHeight;
    phone = !(window.innerWidth >= 1024 || w >= 420);
  };
  measure();
  new ResizeObserver(measure).observe(root);

  // Only touch the DOM when a value changes.
  const last = new Map<string, unknown>();
  const set = (key: string, v: unknown, apply: () => void) => {
    if (last.get(key) !== v) {
      last.set(key, v);
      apply();
    }
  };

  function at(t: number): [Cam, boolean] {
    const list = rests.filter((r) => (phone ? r.p : r.d));
    const cam = (r: Rest) => (phone ? r.p : r.d)!;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const next = list[i + 1];
      if (t <= r.until || !next) return [cam(r), false];
      if (t < next.at) {
        const k = ease(ramp(t, r.until, next.at));
        const [x0, y0, s0] = cam(r);
        const [x1, y1, s1] = cam(next);
        return [[lerp(x0, x1, k), lerp(y0, y1, k), Math.exp(lerp(Math.log(s0), Math.log(s1), k))], true];
      }
    }
    return [cam(list[list.length - 1]), false];
  }

  /** Places the camera for loop time `time`; returns the story time (0 once the dip passes halfway). */
  function frame(time: number) {
    let t = time;
    let fade = 1;
    if (time >= holdEnd) {
      const k = ramp(time, holdEnd, cycle);
      fade = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2;
      if (k >= 0.5) t = 0;
    }
    const [[cx, cy, s], moving] = at(t);
    board.style.transform = `translate(${(w / 2 - cx * s).toFixed(2)}px,${(h / 2 - cy * s).toFixed(2)}px) scale(${s.toFixed(4)})`;
    set('wc', moving, () => (board.style.willChange = moving ? 'transform' : ''));
    set('fade', fade.toFixed(3), () => (board.style.opacity = fade < 1 ? fade.toFixed(3) : ''));
    return t;
  }

  return {
    frame,
    set,
    get phone() {
      return phone;
    },
    get width() {
      return w;
    },
  };
}
