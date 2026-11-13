/**
 * The TapitCard card's story (TapitCardBoard.astro), about 14 s, then a hold to 15 s and a 400 ms
 * crossfade back to the start. render(t) is a pure function of time (pause, loop, first frame, seek).
 *
 * 1 (0-3.4 s)   Create your digital card: the front rises in at a 3D angle (rotateX 18 -> 6,
 *               rotateY -14 -> -8), a sheen sweeps across; "Customize Design" slides in, its check ticks.
 * 2 (3.4-6.8)   Add your links and details: "Add Social Links" and "Business Hours" come in one above
 *               the other and tick in turn; "Unlimited Changes" peeks in at the edge, faded.
 * 3 (6.8-10.2)  Share it with a tap or QR: back to the card, which flips (one 180 degree turn, 900 ms);
 *               zoom to the QR, a scan frame closes in, two NFC waves pulse, the caption chip fades in.
 * 4 (10.2-13.6) Rolled out to whole teams: pull back, flip to the front, fan out into 5 cards
 *               (-8 to +8 degrees, 80 ms apart); "Start NETWORKING!" appears.
 *
 * Camera (board-camera.ts): at rest rebuilt text is at least 13 px on desktop (11 px on phones), and
 * the card's printed logo and URL at least 11 px (10 px) at the beats that focus on them; each
 * rest's focus sits inside the panel's unfaded area. Tilts stay at 18 degrees or less.
 */
import { createCamera, ease, lerp, ramp, type Board, type Rest } from './board-camera';

export const CYCLE = 15400;
export const BEATS = [0, 3400, 6800, 10200];
const HOLD_END = 15000;

const RESTS: Rest[] = [
  { at: 0, until: 1900, d: [270, 279, 1.05], p: [270, 279, 0.58] }, // the card front
  { at: 2400, until: 3400, d: [560, 400, 1], p: [652, 436, 0.8] }, // Customize Design
  { at: 3900, until: 5100, d: [944, 196, 1], p: [944, 156, 0.8] }, // Add Social Links
  { at: 5500, until: 6800, d: [944, 438, 1], p: [944, 457, 0.8] }, // Business Hours
  { at: 7300, until: 8400, d: [270, 279, 1.05], p: [270, 279, 0.58] }, // the card, flipping to the back
  { at: 8900, until: 9450, d: [270, 300, 1.6], p: [270, 300, 1] }, // QR and URL
  { at: 9750, until: 10200, d: [300, 330, 1], p: [270, 432, 0.78] }, // NFC waves, caption chip
  { at: 10800, until: CYCLE, d: [270, 262, 0.88], p: [270, 262, 0.47] }, // the fan, "Start NETWORKING!"
];
const FAN = [-8, -4, 4, 8];

export function createTapit(root: HTMLElement): Board {
  const q = (s: string) => root.querySelector<HTMLElement>(s)!;
  const qa = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s));
  const board = q('[data-tc-board]');
  const card = q('[data-tc-card]');
  const shadow = q('[data-tc-shadow]');
  const brs = q('[data-tc-brs]');
  const net = q('[data-tc-net]');
  const cap = q('[data-tc-cap]');
  const fans = qa('[data-tc-fan]');
  const waves = qa('[data-tc-wave]');
  const feat = (id: string) => {
    const el = q(`[data-tc-feat="${id}"]`);
    return { el, check: el.querySelector<SVGPathElement>('.tc-check')! };
  };
  const [cd, asl, bh, uc] = ['cd', 'asl', 'bh', 'uc'].map(feat);

  const cam = createCamera(root, board, RESTS, HOLD_END, CYCLE);
  const set = cam.set;
  const show = (key: string, el: HTMLElement | SVGElement, op: number, tf = '') =>
    set(key, op.toFixed(3) + tf, () => {
      el.style.opacity = op.toFixed(3);
      el.style.transform = tf;
    });
  const tick = (key: string, path: SVGPathElement, k: number) =>
    set(key, k.toFixed(3), () => (path.style.strokeDashoffset = (1 - k).toFixed(3)));

  function render(time: number) {
    const t = cam.frame(time);

    // The card: rise and tilt in, settle flat, flip to the back, flip back to the front.
    const rise = ease(ramp(t, 0, 800));
    const tilt = ease(ramp(t, 0, 1600));
    const settle = ease(ramp(t, 6800, 7300));
    const flip1 = ease(ramp(t, 7300, 8200));
    const flip2 = ease(ramp(t, 10300, 11200));
    const rx = lerp(lerp(18, 6, tilt), 2, settle) * (1 - flip2);
    const ry = lerp(lerp(-14, -8, tilt), 0, settle) + 180 * flip1 + 180 * flip2;
    show('card', card, rise, `translateY(${(40 * (1 - rise)).toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`);
    const lift = Math.abs(Math.cos((ry * Math.PI) / 180));
    show('shadow', shadow, 0.85 * rise, `scaleX(${(0.5 + 0.5 * lift).toFixed(3)})`);
    // The sheen sweeps while the card tilts in and during each flip.
    const sweep = [ramp(t, 450, 1500), flip1, flip2].find((k) => k > 0 && k < 1) ?? 0;
    set('sheen', sweep.toFixed(3), () => {
      card.style.setProperty('--sh', `${(100 - 100 * sweep).toFixed(1)}%`);
      card.style.setProperty('--sho', (Math.sin(Math.PI * sweep) * 0.9).toFixed(3));
    });

    // The feature cards: in during beats 1 and 2, out as beat 3 turns back to the card.
    const out = 1 - ease(ramp(t, 6800, 7200));
    const cdIn = ease(ramp(t, 1900, 2400));
    show('cd', cd.el, cdIn * out, `translateX(${(60 * (1 - cdIn)).toFixed(1)}px)`);
    tick('cdc', cd.check, ease(ramp(t, 2700, 3000)));
    const aslIn = ease(ramp(t, 3500, 3900));
    show('asl', asl.el, aslIn * out, `translateY(${(16 * (1 - aslIn)).toFixed(1)}px)`);
    tick('aslc', asl.check, ease(ramp(t, 4300, 4600)));
    const bhIn = ease(ramp(t, 3700, 4100));
    show('bh', bh.el, bhIn * out, `translateY(${(16 * (1 - bhIn)).toFixed(1)}px)`);
    tick('bhc', bh.check, ease(ramp(t, 5700, 6000)));
    const ucIn = ease(ramp(t, 3800, 4200));
    show('uc', uc.el, 0.45 * ucIn * out, `translateX(${(24 * (1 - ucIn)).toFixed(1)}px)`);
    tick('ucc', uc.check, 0);

    // Beat 3: the scan frame closes in, two NFC waves pulse, the caption chip fades in.
    const br = ease(ramp(t, 8900, 9250));
    const brOut = 1 - ramp(t, 10200, 10400);
    set('brs', br.toFixed(3) + brOut, () => {
      brs.style.opacity = (br * brOut).toFixed(3);
      brs.style.setProperty('--o', `${(28 * (1 - br)).toFixed(1)}px`);
    });
    waves.forEach((w, i) => {
      const k = ramp(t, 9600 + i * 160, 10100 + i * 160);
      show(`w${i}`, w, Math.sin(Math.PI * k), `scale(${(0.7 + 0.65 * k).toFixed(3)})`);
    });
    const capIn = ease(ramp(t, 9700, 10000)) * (1 - ease(ramp(t, 10200, 10500)));
    show('cap', cap, capIn, `translateY(${(10 * (1 - capIn)).toFixed(1)}px)`);

    // Beat 4: the fan of five (the card plus four copies), then "Start NETWORKING!".
    fans.forEach((f, i) => {
      const k = ease(ramp(t, 11200 + i * 80, 11600 + i * 80));
      show(`f${i}`, f, t >= 11200 + i * 80 ? 1 : 0, `rotate(${(FAN[i] * k).toFixed(2)}deg)`);
    });
    const netIn = ease(ramp(t, 11900, 12300));
    show('net', net, netIn, `scale(${(0.92 + 0.08 * netIn).toFixed(3)})`);
  }

  return { cycle: CYCLE, beats: BEATS, render };
}
