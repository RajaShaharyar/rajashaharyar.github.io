import aboutJson from '../content/about.json';
import { getExperience } from './cv';
import { formatMonth, isIsoDate } from './dates';

export const about = aboutJson;

export interface TimelineEntry {
  date: string;
  dateISO: string | null;
  text: string;
}

/**
 * The My story timeline: the entries in about.json (oldest first), plus each
 * "fromExperience" role whose start date has been filled in in cv.json.
 * A role without a real start date (still a TODO) is left off.
 */
export function buildTimeline(): TimelineEntry[] {
  const { items, fromExperience } = about.story.timeline;
  const entries: TimelineEntry[] = items.map((item) => ({ ...item }));

  for (const auto of fromExperience) {
    const start = getExperience(auto.experienceId).roles[0]?.start;
    if (!isIsoDate(start) || start.length < 7) continue;
    const month = start.slice(0, 7);
    // Place it before the first entry with a later month; year-only and undated entries keep their place.
    const at = entries.findIndex((e) => e.dateISO !== null && e.dateISO.length >= 7 && e.dateISO.slice(0, 7) > month);
    entries.splice(at === -1 ? entries.length : at, 0, { date: formatMonth(month, 'short'), dateISO: month, text: auto.text });
  }
  return entries;
}
