/**
 * Scroll-scrubbed image sequence (ScrollScene.astro). No video element, no WebGL.
 *
 * - progress = clamp((pin top - track top) / (track height - pin height)), frame = round(progress x (N - 1)).
 *   Scrolling up plays the frames backwards; there is no easing or snapping on top of the scroll.
 * - Draws only when the frame changes, inside requestAnimationFrame; the scroll listener is passive and
 *   attached only while the scene is near the viewport.
 * - Loading starts once the visitor has scrolled or interacted and the scene is within 1.5 viewports
 *   (so a page load alone, or Lighthouse, never requests a frame). The set is picked by stage width x
 *   devicePixelRatio (<= 900 px: phone, else desktop). Every 8th frame first, then the rest, at most 6
 *   requests at a time. Frames are kept as compressed blobs; a small window around the current frame
 *   is decoded off the main thread (createImageBitmap, or img.decode()), and until a frame is ready
 *   the nearest decoded one is drawn.
 * - Reduced motion, no JavaScript, data saver or 2G: CSS shows the poster and every step complete;
 *   this script does nothing.
 */

type SetName = 'desktop' | 'phone';
type Drawable = ImageBitmap | HTMLImageElement;

const PHONE_MAX_PX = 900;
const MAX_REQUESTS = 6;
const MAX_DECODES = 3;
const KEEP_DECODED = { desktop: 20, phone: 32 };
const AHEAD = 6;

class ScrollScene {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stageEl: HTMLElement;
  private readonly steps: HTMLElement[];
  private readonly frames: number;
  private readonly beats: number[];
  private readonly base: string;
  private readonly pattern: string;
  private readonly pad: number;
  private readonly version: string;
  private readonly bg: string;
  private readonly wide = window.matchMedia('(width >= 64rem)');

  private set: SetName | null = null;
  private readonly blobs: (Blob | undefined)[];
  private readonly decoded = new Map<number, Drawable>();
  private readonly decoding = new Set<number>();
  private queue: number[] = [];
  private requests = 0;
  private interacted = false;
  private near = false;
  private target = 0;
  private lastTarget = 0;
  private drawn = -1;
  private raf = 0;
  private pinTop = 0;
  private pinHeight = 0;
  private stepStates: string[] = [];

  /** For tests: frames drawn, time spent drawing (ms) and frames downloaded. */
  readonly stats = { draws: 0, drawMs: 0, maxDrawMs: 0, loaded: 0 };

  constructor(root: HTMLElement) {
    this.root = root;
    this.canvas = root.querySelector<HTMLCanvasElement>('.ss-canvas')!;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.stageEl = root.querySelector<HTMLElement>('.ss-stage')!;
    this.steps = Array.from(root.querySelectorAll<HTMLElement>('[data-sync="scroll"] .step'));
    const d = root.dataset;
    this.frames = Number(d.frames);
    this.beats = (d.beats ?? '1').split(',').map(Number);
    this.base = d.base ?? '';
    this.pattern = d.pattern ?? '{set}/f{frame}.webp';
    this.pad = Number(d.pad ?? 3);
    this.version = d.version ?? '';
    this.bg = d.bg ?? '#000';
    this.blobs = new Array(this.frames);

    this.measure();
    this.update();
    this.watch();
  }

  /** The frame on the canvas (0-based), or -1 while the poster shows. */
  get frame() {
    return this.drawn;
  }
  get targetFrame() {
    return this.target;
  }

  private track() {
    return this.wide.matches ? this.root : this.root.querySelector<HTMLElement>('.ss-track')!;
  }
  private pin() {
    return this.root.querySelector<HTMLElement>(this.wide.matches ? '.ss-inner' : '.ss-pin')!;
  }

  private measure() {
    const pin = this.pin();
    this.pinTop = parseFloat(getComputedStyle(pin).top) || 0;
    this.pinHeight = pin.getBoundingClientRect().height;
    this.sizeCanvas();
  }

  private sizeCanvas() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.drawn = -1; // redraw at the new size
    }
  }

  private progress() {
    const r = this.track().getBoundingClientRect();
    const range = r.height - this.pinHeight;
    if (range <= 0) return 0;
    return Math.min(1, Math.max(0, (this.pinTop - r.top) / range));
  }

  private watch() {
    const onScroll = () => this.schedule();
    const near = new IntersectionObserver(
      (entries) => {
        this.near = entries.some((e) => e.isIntersecting);
        if (this.near) {
          window.addEventListener('scroll', onScroll, { passive: true });
          this.measure();
          this.maybeLoad();
          this.schedule();
        } else {
          window.removeEventListener('scroll', onScroll);
        }
      },
      { rootMargin: '150% 0px' },
    );
    near.observe(this.root);

    const resize = new ResizeObserver(() => {
      this.measure();
      this.schedule();
    });
    resize.observe(this.root);
    resize.observe(this.canvas);
    this.wide.addEventListener('change', () => {
      this.measure();
      this.schedule();
    });

    // Load nothing until the visitor scrolls or interacts (a restored scroll position counts).
    const go = () => {
      if (this.interacted) return;
      this.interacted = true;
      for (const type of ['scroll', 'wheel', 'touchstart', 'keydown', 'pointerdown']) window.removeEventListener(type, go);
      this.maybeLoad();
    };
    for (const type of ['scroll', 'wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(type, go, { passive: true });
    if (window.scrollY > 0) go();
  }

  private schedule() {
    if (!this.raf) this.raf = requestAnimationFrame(() => this.update());
  }

  private update() {
    this.raf = 0;
    const t = Math.round(this.progress() * (this.frames - 1));
    if (t !== this.target) {
      this.lastTarget = this.target;
      this.target = t;
    }
    this.syncSteps();
    this.decodeAround();
    const best = this.nearestDecoded(this.target);
    if (best >= 0 && best !== this.drawn) this.draw(best);
  }

  private syncSteps() {
    const f = this.target + 1;
    this.steps.forEach((el, i) => {
      const next = this.beats[i + 1] ?? Infinity;
      const state = f >= next ? 'done' : f >= this.beats[i] ? 'active' : 'upcoming';
      if (this.stepStates[i] !== state) {
        this.stepStates[i] = state;
        el.dataset.state = state;
      }
    });
  }

  private draw(i: number) {
    const img = this.decoded.get(i)!;
    const t0 = performance.now();
    const { width: cw, height: ch } = this.canvas;
    const iw = img.width;
    const ih = img.height;
    const s = Math.min(cw / iw, ch / ih); // contain
    const w = iw * s;
    const h = ih * s;
    if (w < cw || h < ch) {
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, cw, ch);
    }
    this.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    const dt = performance.now() - t0;
    this.stats.draws += 1;
    this.stats.drawMs += dt;
    this.stats.maxDrawMs = Math.max(this.stats.maxDrawMs, dt);
    this.drawn = i;
    if (!this.root.hasAttribute('data-ready')) this.root.setAttribute('data-ready', '');
  }

  private nearestDecoded(t: number) {
    for (let d = 0; d < this.frames; d++) {
      if (this.decoded.has(t - d)) return t - d;
      if (this.decoded.has(t + d)) return t + d;
    }
    return -1;
  }

  // ------------------------------------------------------------------ loading
  private url(i: number) {
    const n = String(i + 1).padStart(this.pad, '0');
    return `${this.base}${this.pattern.replace('{set}', this.set!).replace('{frame}', n)}?v=${this.version}`;
  }

  private maybeLoad() {
    if (this.set || !this.interacted || !this.near) return;
    const px = this.stageEl.getBoundingClientRect().width * (window.devicePixelRatio || 1);
    this.set = px <= PHONE_MAX_PX ? 'phone' : 'desktop';
    this.root.dataset.set = this.set;
    const first: number[] = [];
    for (let i = 0; i < this.frames; i += 8) first.push(i);
    if (first[first.length - 1] !== this.frames - 1) first.push(this.frames - 1);
    const rest: number[] = [];
    for (let i = 0; i < this.frames; i++) if (!first.includes(i)) rest.push(i);
    this.queue = [...first, ...rest];
    this.pump();
  }

  private pump() {
    while (this.requests < MAX_REQUESTS && this.queue.length) {
      const i = this.queue.shift()!;
      this.requests += 1;
      fetch(this.url(i))
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((blob) => {
          this.blobs[i] = blob;
          this.stats.loaded += 1;
          this.decodeAround();
        })
        .catch(() => {
          /* keep the poster / nearest frame */
        })
        .finally(() => {
          this.requests -= 1;
          this.pump();
        });
    }
  }

  /** Decode the frames around the target (ahead in the scroll direction first) and drop far ones. */
  private decodeAround() {
    if (!this.set) return;
    const dir = this.target >= this.lastTarget ? 1 : -1;
    const want: number[] = [this.target];
    for (let d = 1; d <= AHEAD; d++) want.push(this.target + dir * d, this.target - dir * d);
    if (this.nearestDecoded(this.target) < 0) {
      // nothing on screen yet: the nearest frame that has arrived, whatever its distance
      for (let d = AHEAD + 1; d < this.frames; d++) {
        if (this.blobs[this.target - d]) {
          want.push(this.target - d);
          break;
        }
        if (this.blobs[this.target + d]) {
          want.push(this.target + d);
          break;
        }
      }
    }
    for (const i of want) {
      if (this.decoding.size >= MAX_DECODES) break;
      if (i < 0 || i >= this.frames || this.decoded.has(i) || this.decoding.has(i) || !this.blobs[i]) continue;
      this.decode(i);
    }
  }

  private decode(i: number) {
    const blob = this.blobs[i]!;
    this.decoding.add(i);
    const viaImg = async (): Promise<Drawable> => {
      const img = new Image();
      const src = URL.createObjectURL(blob);
      img.src = src;
      try {
        await img.decode();
      } finally {
        URL.revokeObjectURL(src);
      }
      return img;
    };
    const job: Promise<Drawable> = 'createImageBitmap' in window ? createImageBitmap(blob).catch(viaImg) : viaImg();
    job
      .then((img) => {
        this.decoded.set(i, img);
        this.evict();
        this.schedule();
      })
      .catch(() => {})
      .finally(() => {
        this.decoding.delete(i);
        this.decodeAround();
      });
  }

  private evict() {
    const keep = KEEP_DECODED[this.set ?? 'phone'];
    if (this.decoded.size <= keep) return;
    const far = [...this.decoded.keys()].sort((a, b) => Math.abs(b - this.target) - Math.abs(a - this.target));
    for (const i of far.slice(0, this.decoded.size - keep)) {
      if (i === this.drawn) continue;
      const img = this.decoded.get(i);
      if (img && 'close' in img) img.close();
      this.decoded.delete(i);
    }
  }
}

/** Sets each scene up only when it comes within 1.5 viewports: on page load this is one observer. */
export function initScrollScenes() {
  const root = document.documentElement;
  if (root.classList.contains('save-data')) return;
  if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const scenes = document.querySelectorAll<HTMLElement>('[data-scroll-scene]');
  if (!scenes.length) return;
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        near.unobserve(e.target);
        const el = e.target as HTMLElement & { scrollScene?: ScrollScene };
        el.scrollScene ??= new ScrollScene(el);
      }
    },
    { rootMargin: '150% 0px' },
  );
  scenes.forEach((el) => near.observe(el));
}
