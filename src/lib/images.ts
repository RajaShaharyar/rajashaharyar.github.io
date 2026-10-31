import manifest from '../content/images.json';

export interface ImageInfo {
  width: number;
  height: number;
  alt: string;
  caption: string;
  source: string;
}

/** Keys are paths under public/images, e.g. "speaking/talk-numl-session.webp". */
const images: Record<string, ImageInfo> = manifest;

/** True once `npm run images` has produced the file. */
export function hasImage(key: string | null | undefined): key is string {
  return Boolean(key && images[key]);
}

/** Look up an image; fails the build on a typo or a missing file. */
export function getImage(key: string): ImageInfo & { src: string } {
  const info = images[key];
  if (!info) {
    throw new Error(`Image "${key}" is not in src/content/images.json. Add it to scripts/images.mjs and run npm run images.`);
  }
  return { ...info, src: `/images/${key}` };
}
