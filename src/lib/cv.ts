import cvJson from '../content/cv.json';
import { site, filled } from './site';
import { formatRange, isIsoDate } from './dates';

/**
 * Typed access to cv.json, the one source for CV facts. /cv, the PDF and the
 * About pages all read from here, so they can't drift apart.
 * Values starting with "TODO" are missing data: they are hidden, never shown.
 */

/** A bullet whose wording depends on a fact that may still be missing. */
export interface PreSalesBullet {
  text: string;
  /** Used once Tapit's pre-sales currency is known; "{preSales}" becomes e.g. "PKR 40K" */
  withPreSales: string;
}
export type Bullet = string | PreSalesBullet;

export interface ExperienceRole {
  title: string;
  /** "YYYY-MM", "YYYY-MM-DD" or a "TODO: …" placeholder */
  start: string;
  end: string | null;
  bullets: Bullet[];
}

export interface ExperienceItem {
  id: string;
  company: string;
  companyFull?: string;
  location: string;
  href: string;
  product?: string;
  summary?: string;
  roles: ExperienceRole[];
}

export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  city: string;
  location: string;
  start: string;
  end: string;
  website?: string;
  finalYearProject: {
    title: string;
    description: string;
    cvLine: string;
    award: string;
    awardDate: string;
    presentedAt?: string;
    recognitionIds: string[];
  };
  grade?: string;
}

export interface Programme {
  id: string;
  cvLabel: string;
  provider: string;
  providerFull?: string;
  name: string;
  mode?: string;
  year?: string;
  start: string;
  end: string | null;
  website?: string;
  image?: string;
  covered?: string;
  certificate?: string;
  venture?: string;
  note?: string;
  recognitionIds?: string[];
}

export interface SkillGroup {
  name: string;
  items: string[];
}

export interface Language {
  name: string;
  level: string;
}

interface Section {
  section: number;
  title: string;
  menuLabel?: string;
}

export interface Cv {
  header: Section & {
    name: string;
    headline: string;
    tagline: string;
    location: string;
    website: { display: string; href: string };
    downloadLabel: string;
  };
  summary: Section & { text: string; draft?: boolean };
  keyNumbers: Section;
  experience: Section & { linkLabel: string; items: ExperienceItem[] };
  otherVentures: Section & {
    items: { id: string; name: string; role: string; when?: string; dates?: string; text: string; href: string }[];
  };
  education: Section & { items: EducationItem[] };
  programmes: Section & { items: Programme[] };
  honours: Section & { items: { title: string; date: string | null; dateISO: string; recognitionId: string }[] };
  speaking: Section & { items: { text: string; date: string | null; recognitionId: string }[]; pdfLine: string };
  partnerships: Section & {
    mousLabel: string;
    mous: { text: string; recognitionId: string }[];
    counts: { value: string; label: string }[];
    pdfLine: string;
  };
  skills: Section & { groups: SkillGroup[] };
  languages: Section & { items: Language[] };
  leadership: Section & { items: { text: string; date: string | null; recognitionIds: string[] }[]; pdfLine: string };
  references: Section & { text: string };
}

export const cv = cvJson as unknown as Cv;

function byId<T extends { id: string }>(list: T[], id: string, what: string): T {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`${what} "${id}" is not in src/content/cv.json.`);
  return found;
}

export const getExperience = (id: string) => byId(cv.experience.items, id, 'Experience');
export const getEducation = (id: string) => byId(cv.education.items, id, 'Education item');
export const getProgramme = (id: string) => byId(cv.programmes.items, id, 'Programme');

/** "Oct 2025 – present", "Mar – Nov 2024"; null while the start date is still a TODO (so it can be hidden). */
export function roleDates(role: Pick<ExperienceRole, 'start' | 'end'>): string | null {
  if (!isIsoDate(role.start)) return null;
  const end = role.end === null ? null : isIsoDate(role.end) ? role.end : undefined;
  if (end === undefined) return null; // an end date that is still a TODO hides the whole range
  return formatRange(role.start, end, 'short');
}

/** A programme's CV dates: the range when known, else its year, else null. */
export function programmeDates(p: Programme): string | null {
  if (isIsoDate(p.start)) return formatRange(p.start, isIsoDate(p.end) ? p.end : null, 'short');
  return filled(p.year) ?? null;
}

/** Tapit's pre-sales as "PKR 40K" once the currency is filled in, else undefined. */
function preSales(): string | undefined {
  const facts = site.ventures.find((v) => v.id === 'tapit')?.facts as
    | { preSales?: { amount?: string; currency?: string } }
    | undefined;
  const currency = filled(facts?.preSales?.currency);
  const amount = filled(facts?.preSales?.amount);
  return currency && amount ? `${currency} ${amount}` : undefined;
}

/** The text a bullet shows right now. */
export function bulletText(bullet: Bullet): string {
  if (typeof bullet === 'string') return bullet;
  const amount = preSales();
  return amount ? bullet.withPreSales.replace('{preSales}', amount) : bullet.text;
}
