import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * True if a file exists in public/ at build time, e.g. publicFileExists('/cv.pdf').
 * Used to show the "Download CV" button only once public/cv.pdf has been added.
 * Builds always run from the project root (npm run build / withastro/action).
 */
export function publicFileExists(href: string): boolean {
  return existsSync(join(process.cwd(), 'public', href.replace(/^\//, '')));
}
