import log from '../content/recognition.json';
import { hasImage } from './images';

/**
 * The Recognition log (src/content/recognition.json): the single source for
 * /recognition, its four sub-pages and the homepage carousel. Its schema is
 * checked at build time in src/content.config.ts. Text fields that still hold
 * "TODO: …" are hidden wherever they are shown (see filled() in ./site).
 */

export type Badge = 'Winner' | 'Top 3' | 'Award' | 'Programme' | 'Office' | 'MOU' | 'Talk' | 'Event' | 'Represented' | 'Media';

export interface RecognitionPhoto {
  file: string;
  caption?: string;
  source: string;
}

export interface RecognitionItem {
  id: string;
  category: string;
  badge: Badge | null;
  title: string;
  subtitle?: string;
  organiser?: string;
  venue?: string;
  date: string;
  dateISO: string | null;
  prize?: string;
  detail?: string;
  summary?: string;
  role?: string;
  selectivity?: string;
  gave?: string;
  purpose?: string;
  recognisedBy?: string;
  venture: { name: string; href: string } | null;
  photos: RecognitionPhoto[];
  links?: { label: string; href: string }[];
  shownOn: string[];
  order?: number;
  highlight?: { order: number; line: string };
  note?: string;
  todo?: string[];
  toConfirm: string[];
}

/** The log in its file order (newest first, undated ranges first). */
export const recognition = log as RecognitionItem[];

/** Look up one log item by id; fails the build on a typo. */
export function getRecognition(id: string): RecognitionItem {
  const item = recognition.find((r) => r.id === id);
  if (!item) throw new Error(`Recognition item "${id}" is not in src/content/recognition.json.`);
  return item;
}

/** Fail the build if any referenced id (e.g. from cv.json) is missing from the log. */
export function assertRecognitionIds(ids: string[], from: string): void {
  const missing = ids.filter((id) => !recognition.some((r) => r.id === id));
  if (missing.length) throw new Error(`${from} points at recognition ids that don't exist: ${missing.join(', ')}`);
}

/** Display order: the item's `order`, then newest date first. */
function byOrder(a: RecognitionItem, b: RecognitionItem): number {
  return (a.order ?? 999) - (b.order ?? 999) || (b.dateISO ?? '').localeCompare(a.dateISO ?? '');
}

/** Items listed on a page, per the log's "Shown on" column, optionally only some badges, in display order. */
export function shownOn(page: string, badges?: Badge[]): RecognitionItem[] {
  return recognition
    .filter((r) => r.shownOn.includes(page) && (!badges || (r.badge !== null && badges.includes(r.badge))))
    .sort(byOrder);
}

/** How many log items carry a badge (each item counts once). */
export function countBadge(badge: Badge): number {
  return recognition.filter((r) => r.badge === badge).length;
}

/** The highlight cards for /recognition, in their order. */
export function highlights(): (RecognitionItem & { highlight: { order: number; line: string } })[] {
  return recognition
    .filter((r): r is RecognitionItem & { highlight: { order: number; line: string } } => Boolean(r.highlight))
    .sort((a, b) => a.highlight.order - b.highlight.order);
}

/** An item's photos; fails the build if one isn't in images.json (run npm run images). */
export function photosOf(item: RecognitionItem): RecognitionPhoto[] {
  const missing = item.photos.filter((p) => !hasImage(p.file));
  if (missing.length) {
    throw new Error(`Recognition item "${item.id}" has photos not in images.json: ${missing.map((p) => p.file).join(', ')}`);
  }
  return item.photos;
}
