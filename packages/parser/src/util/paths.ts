import fs from 'node:fs';
import path from 'node:path';

/** Synchronously walks the given directory and returns all files in it. */
export function walk(dir: string): string[] {
  try {
    return (
      fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((f) => f.isFile())
        // Node <20 f.path may be undefined
        .map((f) => path.resolve(f.path || dir, f.name))
    );
  } catch (e: any) {
    // Ignore if folder does not exist
    if (e.code === 'ENOENT') {
      return [];
    }

    throw e;
  }
}

/**
 * Makes the given path relative to the current working directory (`./`).
 *
 * Posix: `./<dir>`, in windows: `.\\<dir>`
 */
export function cwdRelative(p: string) {
  return path.join('./') + path.normalize(p);
}

const WIN32_PATH_SEP = /\\/g;

/** Replaces all path separators with `/` to make it compatible with TS compiler. */
export function toTsPath(p: string) {
  // TS compiler always uses `/` as path separator
  if (path.sep === path.win32.sep) {
    return p.replace(WIN32_PATH_SEP, '/');
  }

  return p;
}
