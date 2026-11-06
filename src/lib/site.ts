import siteJson from '../content/site.json';

export interface NavLink {
  label: string;
  href: string;
  description?: string;
  children?: NavLink[];
}

export interface Venture {
  id: string;
  name: string;
  role?: string;
  href: string;
  external: string;
  footer: boolean;
  meta: string;
  badge?: string;
  metric?: { value: string; label: string };
  line: string;
  image?: { src: string; fit: 'cover' | 'contain'; position?: string };
  /** Facts for the venture page (Raja's answers); not shown on the homepage. */
  facts?: Record<string, unknown>;
  /** cv.json experience ids (Consulting & product roles). */
  roles?: string[];
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
  stage: string;
  summary: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  role?: string;
  company?: string;
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
    form: { formspreeId: string };
  };
  cv: { pageHref: string; pdfHref: string; todo: string };
  cta: { label: string; href: string };
  nav: NavLink[];
  ventures: Venture[];
  stats: Stat[];
  offers: Offer[];
  testimonials: Testimonial[];
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

/** Strip the leading "TODO:" from a placeholder string for display. */
export function todoText(value: string): string {
  return value.replace(/^TODO:\s*/, '');
}
