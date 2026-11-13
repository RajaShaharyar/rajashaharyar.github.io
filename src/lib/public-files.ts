import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * True if a file exists in public/ at build time, e.g. publicFileExists('/Raja-Shaharyar-PM.pdf').
 * Used to show the CV page's PDF download only while the file is there.
 * Builds always run from the project root (npm run build / withastro/action).
 */
export function publicFileExists(href: string): boolean {
  return existsSync(join(process.cwd(), 'public', href.replace(/^\//, '')));
}
