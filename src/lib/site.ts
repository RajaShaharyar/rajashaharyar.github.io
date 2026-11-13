import siteJson from '../content/site.json';

export interface NavLink {
  label: string;
  href: string;
  description?: string;
  children?: NavLink[];
  /** The one highlighted item of a dropdown (About → "Invite me to speak") */
  highlight?: boolean;
}

/** A venture card (/ventures, and the homepage product section). The page itself lives in src/content/ventures/<id>.mdx. */
export interface Venture {
  id: string;
  name: string;
  href: string;
  meta: string;
  /** Raja's role, shown in the homepage product section */
  role?: string;
  badge?: string;
  metric?: { value: string; label: string };
  line: string;
  image?: { src: string; fit: 'cover' | 'contain'; position?: string };
  /** No photo: show the product's schematic drawing (ProductScene, final frame) in the card instead */
  art?: boolean;
}

export interface Stat {
  id: string;
  value: string;
  label: string;
  source: string;
  toConfirm?: string;
}

export interface Offer {
  id: string;
  title: string;
  stage?: string;
  /** Shown in the homepage "How I can help" (with its summary) */
  home: boolean;
  summary?: string;
  forWhom: string;
  gets: string;
  proof: { label: string; href: string };
}

export interface Testimonial {
  quote: string;
  name: string;
  role?: string;
  company?: string;
  /** site.json → ventures id: the quote also shows in that venture's case study (Testimonial section) */
  venture?: string;
}

export interface Site {
  name: string;
  shortName: string;
  title: string;
  company: string;
  tagline: string;
  description: string;
  url: string;
  locale: string;
  location: { display: string; city: string; countryCode: string };
  contact: {
    email: string;
    phone: { display: string; href: string };
    whatsapp: { display: string; href: string };
    linkedin: { display: string; href: string };
    digitalCard: { display: string; href: string };
    booking: { href: string; todo: string };
    /** Contact form: "web3forms" or "formspree" sends from the page; "" opens the visitor's email app */
    form: { provider: '' | 'web3forms' | 'formspree'; web3formsKey: string; formspreeId: string };
  };
  /** The CV: web page, PDF and the file name a download is saved as */
  cv: { pageHref: string; pdfHref: string; downloadName: string };
  cta: { label: string; href: string };
  /** Top bar: Home · Ventures ▾ · Work With Me · About · CV (then the cta button) */
  nav: NavLink[];
  /** The Recognition pages: no longer in the top bar; used for their tabs and the footer */
  recognitionMenu: NavLink & { children: NavLink[] };
  ventures: Venture[];
  stats: Stat[];
  offers: Offer[];
  testimonials: Testimonial[];
  /** Optional, cookie-free analytics; off while provider is "" */
  analytics: { provider: '' | 'goatcounter' | 'cloudflare' | 'plausible'; id: string };
}

/** site.json, type-checked against the Site interface at build time. */
export const site: Site = siteJson as Site;

/** Normalise a path to the trailing-slash form GitHub Pages serves. */
export function withSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/** True for a value that is still missing: empty, or a "TODO:" placeholder. Such fields are hidden on the site. */
export function isTodo(value: unknown): boolean {
  return value == null || (typeof value === 'string' && (value.trim() === '' || value.trim().startsWith('TODO')));
}

/** The value if it is filled in, otherwise undefined (so the field can be hidden). */
export function filled<T>(value: T | null | undefined): T | undefined {
  return isTodo(value) ? undefined : (value as T);
}

