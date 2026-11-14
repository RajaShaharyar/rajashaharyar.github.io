/**
 * Raja's portraits (Phase 19; files in public/media/portraits/, made by tools/portraits/process.py, entries in
 * images.json under portraits/…). Shared here so the homepage can preload exactly what the hero shows.
 */
import { getImage } from './images';

/** The hero portrait's slot: about 560 px wide from 1024 px, the column's width below it. */
export const HERO_PORTRAIT_SIZES = '(min-width: 1024px) 560px, calc(100vw - 2rem)';

/** The hero portrait, for the hero and its preload (the LCP element). */
export function heroPortrait(key: string) {
  return { ...getImage(key), sizes: HERO_PORTRAIT_SIZES };
}
