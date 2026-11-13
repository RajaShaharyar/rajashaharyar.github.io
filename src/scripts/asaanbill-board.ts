/**
 * The AsaanBill card's 14 s story (AsaanBillBoard.astro): a camera that pans and zooms one board
 * of rebuilt portal UI, one readable focus area per beat. render(t) is a pure function of time, so
 * the deck can pause, loop and show the first frame; tests can seek.
 *
 * Camera (board-camera.ts): rests are [centre x, centre y, scale] in board px. Scales are set by
 * legibility, not by the panel: at rest no text is under 13 px on desktop (11 px on phones) and key
 * numbers are 16 px or more; phones zoom further. Each rest's focus sits inside the panel's
 * unfaded area (the edge fade, VentureDeck.astro).
 */
import { createCamera, ease, ramp, type Board, type Rest } from './board-camera';

export const CYCLE = 14700;
export const BEATS = [0, 3200, 6400, 9600];
const HOLD_END = 14300;

const RESTS: Rest[] = [
  { at: 0, until: 550, d: [168, 105, 1.5], p: [128, 104, 1.19] }, // collection tiles, PSID selected
  { at: 1150, until: 1750, d: [190, 292, 1.45], p: [131, 282, 1.23] }, // invoice: customer and title
  { at: 2200, until: 3200, d: [362, 352, 1.55], p: [440, 400, 1.53] }, // invoice: amount (and status)
  { at: 3800, until: 6400, d: [170, 466, 1.7] }, // How to pay, PSID resolves
  { at: 3800, until: 4300, p: [154.5, 488, 1.11] }, // phones: How to pay and its text (PSID still masked),
  { at: 4700, until: 6400, p: [121, 464, 1.25] }, // then the PSID as it resolves
  { at: 6900, until: 7950, d: [425, 252, 1.8], p: [446, 256, 1.4] }, // status chip
  { at: 8500, until: 8950, d: [383, 798, 1], p: [285, 798, 0.95] }, // Reports row: amount, paid
  { at: 9300, until: 9650, d: [520, 798, 1], p: [635, 798, 0.95] }, // Reports row: settled, chip
  { at: 10050, until: 10250, d: [220, 1023, 1], p: [85, 1023, 0.86] }, // stepper: the camera follows the active pill
  { at: 10450, until: 10600, d: [296, 1023, 1], p: [296, 1023, 0.86] },
  { at: 10800, until: 10900, d: [340, 1023, 1], p: [490, 1023, 0.86] },
  { at: 11300, until: 11800, d: [259, 1268, 1], p: [128, 1268, 0.95] }, // Disbursement
  { at: 12200, until: CYCLE, d: [688, 1268, 1.3], p: [688, 1268, 0.95] }, // donut, then hold
];

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;

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

  const cam = createCamera(root, board, RESTS, HOLD_END, CYCLE);
  const set = cam.set;

  function render(time: number) {
    const t = cam.frame(time);

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
    groups.forEach((g, i) => set(`g${i}`, t >= 4800 + i * 120, () => g.classList.toggle('is-masked', t < 4800 + i * 120)));

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
