import log from '../content/recognition.json';

export interface Evidence {
  source: string;
  file: string | null;
  note?: string;
}

export interface RecognitionItem {
  id: string;
  date: string;
  dateISO: string | null;
  item: string;
  shownOn: string[];
  shownOnNote?: string;
  venture: string | null;
  evidence: Evidence[];
  note?: string;
  todo?: string[];
  toConfirm: string[];
}

/** The Recognition log in its original order (newest first, undated last). Schema-checked in content.config.ts. */
export const recognition: RecognitionItem[] = log;

/** Items listed on a given page, per the log's "Shown on" column. */
export function shownOn(page: string): RecognitionItem[] {
  return recognition.filter((r) => r.shownOn.includes(page));
}

/** Look up one log item by id; fails the build on a typo. */
export function getRecognition(id: string): RecognitionItem {
  const item = recognition.find((r) => r.id === id);
  if (!item) throw new Error(`Recognition item "${id}" is not in src/content/recognition.json.`);
  return item;
}
