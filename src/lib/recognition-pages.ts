import copy from '../content/recognition-pages.json';
import { site } from './site';
import { countBadge, type Badge } from './recognition';

/** Copy for /recognition and its sub-pages (src/content/recognition-pages.json). */
export const recognitionCopy = copy;

/** A Recognition sub-page's menu entry (label = H1, description = intro), from site.json → nav. */
export function recognitionMenuEntry(href: string): { label: string; href: string; description: string } {
  const entry = site.nav.find((item) => item.href === '/recognition/')?.children?.find((c) => c.href === href);
  if (!entry) throw new Error(`"${href}" is not in the Recognition menu in site.json.`);
  return { label: entry.label, href: entry.href, description: entry.description ?? '' };
}

/** A counter for a badge: the computed count with its singular or plural label. */
export function badgeCounter(badge: string): { value: number; label: string } {
  const def = copy.overview.counters.find((c) => c.badge === badge);
  if (!def) throw new Error(`No counter label for badge "${badge}" in recognition-pages.json.`);
  const value = countBadge(badge as Badge);
  return { value, label: value === 1 ? def.one : def.other };
}

/** Which sub-page an item's card lives on, for links from the overview. */
export function pageFor(badge: Badge | null): string {
  if (badge === 'Winner' || badge === 'Top 3' || badge === 'Award') return '/recognition/competitions-awards/';
  if (badge === 'Programme' || badge === 'Office') return '/recognition/programmes/';
  if (badge === 'MOU') return '/recognition/partnerships/';
  return '/recognition/speaking-events/';
}
