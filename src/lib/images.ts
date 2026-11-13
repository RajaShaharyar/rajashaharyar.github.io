import manifest from '../content/images.json';

export interface ImageInfo {
  width: number;
  height: number;
  /** Every width available on disk, ascending; the largest is the plain file name */
  widths: number[];
  alt: string;
  caption: string;
  /** Photographer's credit, shown with the caption wherever the photo appears */
  credit?: string;
  source: string;
  /**
   * Files that live outside public/images, by width (the TapitCard card faces reuse the deck's
   * public/media/tapitcard/ files): when set, these URLs are used instead of /images/<key>.
   */
  urls?: Record<string, string>;
}

/** Keys are paths under public/images, e.g. "speaking/talk-numl-session.webp" (or a name for an entry with urls). */
const images: Record<string, ImageInfo> = manifest;

/** True once `npm run images` has produced the file. */
export function hasImage(key: string | null | undefined): key is string {
  return Boolean(key && images[key]);
}

/** URL of the copy that is `width` px wide ("…-480.webp"); the largest keeps the plain name. */
function urlFor(key: string, width: number, largest: number, urls?: Record<string, string>): string {
  if (urls) return urls[String(width)];
  return `/images/${width === largest ? key : key.replace(/\.webp$/, `-${width}.webp`)}`;
}

/** Look up an image; fails the build on a typo or a missing file. */
export function getImage(key: string): ImageInfo & { src: string; srcset: string } {
  const info = images[key];
  if (!info) {
    throw new Error(`Image "${key}" is not in src/content/images.json. Add it to scripts/images.mjs and run npm run images.`);
  }
  const widths = info.widths?.length ? info.widths : [info.width];
  const srcset = widths.map((w) => `${urlFor(key, w, info.width, info.urls)} ${w}w`).join(', ');
  return { ...info, widths, src: urlFor(key, info.width, info.width, info.urls), srcset };
}

/** Caption with the photographer's credit appended, for places that show one line of text. */
export function captionWithCredit(key: string, caption?: string): string {
  const img = getImage(key);
  const text = caption ?? img.caption;
  return img.credit ? `${text} · ${img.credit}` : text;
}
