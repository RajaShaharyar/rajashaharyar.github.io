/**
 * The AsaanBill card's 14 s story (AsaanBillBoard.astro): a camera that pans and zooms one board
 * of rebuilt portal UI, one readable focus area per beat. render(t) is a pure function of time, so
 * the deck can pause, loop and show the first frame; tests can seek.
 *
 * Camera rests are [centre x, centre y, scale] in board px. Scales are set by legibility, not by the
 * panel: at rest no text is under 13 px on desktop (11 px on phones) and key numbers are 16 px or
 * more; phones zoom further. will-change is only on during a move, so text re-rasterises sharp at rest.
 */
type Cam = [number, number, number];
interface Rest {
  at: number;
  until: number;
  d?: Cam;
  p?: Cam;
}

export const CYCLE = 14700;
export const BEATS = [0, 3200, 6400, 9600];
const HOLD_END = 14300;

const RESTS: Rest[] = [
  { at: 0, until: 550, d: [190, 105, 1.5], p: [128, 104, 1.25] }, // collection tiles, PSID selected
  { at: 1150, until: 1750, d: [190, 292, 1.45], p: [131, 282, 1.23] }, // invoice: customer and title
  { at: 2200, until: 3200, d: [362, 352, 1.55], p: [420, 400, 1.53] }, // invoice: amount (and status)
  { at: 3800, until: 6400, d: [170, 466, 1.7], p: [153.5, 470, 1.22] }, // How to pay, PSID resolves
  { at: 6900, until: 7950, d: [425, 252, 1.8], p: [446, 256, 1.4] }, // status chip
  { at: 8500, until: 8950, d: [383, 798, 1], p: [285, 798, 0.95] }, // Reports row: amount, paid
  { at: 9300, until: 9650, d: [520, 798, 1], p: [640, 798, 0.95] }, // Reports row: settled, chip
  { at: 10050, until: 10250, d: [280, 1023, 1], p: [190, 1023, 0.86] }, // stepper
  { at: 10450, until: 10600, p: [300, 1023, 0.86] }, // phones follow the active pill
  { at: 10800, until: 10900, p: [372, 1023, 0.86] },
  { at: 11300, until: 11800, d: [259, 1268, 1], p: [175, 1268, 0.95] }, // Disbursement
  { at: 12200, until: CYCLE, d: [688, 1268, 1.3], p: [688, 1268, 1.15] }, // donut, then hold
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;

export interface Board {
  cycle: number;
  beats: number[];
  render(t: number): void;
}

export function createBoard(root: HTMLElement): Board {
  const q = <T extends Element = HTMLElement>(s: string) => root.querySelector<T & HTMLElement>(s)!;
  const qa = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s));
  const board = q('[data-ab-board]');
  const psid = q('[data-ab-psid]');
  const invoice = q('[data-ab-invoice]');
  const chip = q('[data-ab-chip]');
  const row = q('[data-ab-row]');
  const stepper = q('[data-ab-stepper]');
  const amounts = qa('[data-ab-amount]');
  const groups = qa('[data-ab-grp]');
  const arcs = qa('.ab-arc');
  const fields = (['cust', 'title'] as const).map((k) => ({ ph: q(`[data-ab-ph="${k}"]`), val: q(`[data-ab-val="${k}"]`) }));

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

  function camera(t: number): [Cam, boolean] {
    const rests = RESTS.filter((r) => (phone ? r.p : r.d));
    const cam = (r: Rest) => (phone ? r.p : r.d)!;
    for (let i = 0; i < rests.length; i++) {
      const r = rests[i];
      const next = rests[i + 1];
      if (t <= r.until || !next) return [cam(r), false];
      if (t < next.at) {
        const k = ease(ramp(t, r.until, next.at));
        const [x0, y0, s0] = cam(r);
        const [x1, y1, s1] = cam(next);
        return [[x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * k)], true];
      }
    }
    return [cam(rests[rests.length - 1]), false];
  }

  function render(time: number) {
    // Hold to 14.3 s, then dip to the start over 400 ms.
    let t = time;
    let fade = 1;
    if (time >= HOLD_END) {
      const k = ramp(time, HOLD_END, CYCLE);
      fade = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2;
      if (k >= 0.5) t = 0;
    }
    const [[cx, cy, s], moving] = camera(t);
    board.style.transform = `translate(${(w / 2 - cx * s).toFixed(2)}px,${(h / 2 - cy * s).toFixed(2)}px) scale(${s.toFixed(4)})`;
    set('wc', moving, () => (board.style.willChange = moving ? 'transform' : ''));
    set('fade', fade.toFixed(3), () => (board.style.opacity = fade < 1 ? fade.toFixed(3) : ''));

    // Beat 1: PSID selected, the invoice rises in, customer and title fill in, the amount counts up.
    set('psid', t >= 350, () => psid.classList.toggle('is-selected', t >= 350));
    const rise = ease(ramp(t, 550, 1000));
    set('rise', rise.toFixed(3), () => {
      invoice.style.opacity = rise < 1 ? rise.toFixed(3) : '';
      invoice.style.transform = rise < 1 ? `translateY(${(12 * (1 - rise)).toFixed(2)}px)` : '';
    });
    [1450, 1150].forEach((at, i) => {
      const f = fields[i];
      const shown = t >= at;
      const op = ramp(t, at, at + 200);
      set(`f${i}`, shown ? op.toFixed(2) : 'ph', () => {
        f.ph.style.display = shown ? 'none' : 'inline-block';
        f.val.style.display = shown ? '' : 'none';
        f.val.style.opacity = shown && op < 1 ? op.toFixed(2) : '';
      });
    });
    const amount = rs(166800 * ease(ramp(t, 2200, 2900)));
    set('amt', amount, () => amounts.forEach((el) => (el.textContent = amount)));

    // Beat 2: the masked PSID resolves, group by group, 120 ms apart.
    groups.forEach((g, i) => set(`g${i}`, t >= 4100 + i * 120, () => g.classList.toggle('is-masked', t < 4100 + i * 120)));

    // Beat 3: Unpaid → Pending → Settled; the Reports row slides in.
    const status = t < 7100 ? 'unpaid' : t < 7700 ? 'pending' : 'settled';
    set('chip', status, () => (chip.dataset.abChip = status));
    const slide = ease(ramp(t, 7900, 8400));
    set('row', slide.toFixed(3), () => {
      row.style.opacity = slide < 1 ? slide.toFixed(3) : '';
      row.style.transform = slide < 1 ? `translateX(${(40 * (1 - slide)).toFixed(2)}px)` : '';
    });

    // Beat 4: the stepper's active pill moves along; the donut draws to 45 %.
    const step = t < 10300 ? '0' : t < 10650 ? '1' : '2';
    set('step', step, () => (stepper.dataset.abStepper = step));
    const draw = ease(ramp(t, 12000, 12900));
    set('donut', draw.toFixed(3), () => arcs.forEach((a) => (a.style.strokeDashoffset = (100 * (1 - draw)).toFixed(2))));
  }

  return { cycle: CYCLE, beats: BEATS, render };
}
