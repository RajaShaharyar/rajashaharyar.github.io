/** Date helpers for the data files' ISO-style dates: "2023", "2023-05" or "2023-05-09". */

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));

export type DateStyle = 'long' | 'short';

/** True for "YYYY", "YYYY-MM" or "YYYY-MM-DD" (false for null, "" and "TODO: …"). */
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value);
}

function parts(iso: string) {
  const [year, month] = iso.split('-');
  return { year, month: month ? Number(month) - 1 : null };
}

/** "2023-05" → "May 2023" (long) or "May 2023" / "Sep 2020" (short). Day precision is dropped. */
export function formatMonth(iso: string, style: DateStyle = 'long'): string {
  const { year, month } = parts(iso);
  if (month === null) return year;
  return `${(style === 'long' ? MONTHS_LONG : MONTHS_SHORT)[month]} ${year}`;
}

/**
 * A date range in the site's style:
 *   ("2023-03", "2023-08") → "March – August 2023"
 *   ("2023-03", "2024-02") → "March 2023 – February 2024"
 *   ("2025-10", null)      → "October 2025 – present"
 */
export function formatRange(start: string, end: string | null, style: DateStyle = 'long'): string {
  if (end === null) return `${formatMonth(start, style)} – present`;
  const a = parts(start);
  const b = parts(end);
  if (a.year === b.year && a.month !== null && b.month !== null) {
    if (a.month === b.month) return formatMonth(start, style);
    const names = style === 'long' ? MONTHS_LONG : MONTHS_SHORT;
    return `${names[a.month]} – ${names[b.month]} ${a.year}`;
  }
  return `${formatMonth(start, style)} – ${formatMonth(end, style)}`;
}
