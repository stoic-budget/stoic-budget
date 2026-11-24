import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function resolveUploadsDir(): string {
  const candidates = [
    process.env.UPLOADS_DIR,
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), '..', 'uploads'),
    path.join(os.tmpdir(), 'seneca-uploads'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // Try next candidate
    }
  }

  throw new Error('No writable uploads directory available');
}

/**
 * The path resolved, or NULL when it falls outside the uploads directory. Every
 * file the server reads back was written there (multer, restore), so a
 * path elsewhere means a tampered row or a broken invariant. Callers repeat the
 * prefix check next to the filesystem call so the bound is visible there.
 */
export function resolveInUploadsDir(
  candidatePath: string,
  uploadsRoot: string = path.resolve(resolveUploadsDir()),
): string | null {
  const resolved = path.resolve(candidatePath);
  return resolved === uploadsRoot || resolved.startsWith(`${uploadsRoot}${path.sep}`)
    ? resolved
    : null;
}

/** Reads a file the server wrote under the uploads directory; refuses any other path. */
export function readUploadedFile(filePath: string): Promise<Buffer> {
  const uploadsRoot = path.resolve(resolveUploadsDir());
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(`${uploadsRoot}${path.sep}`)) {
    return Promise.reject(new Error('File is outside the uploads directory'));
  }
  return fs.promises.readFile(resolved);
}

/**
 * Whether a row still names a stored file (#789). A copy of a past version
 * and a backup restored on the same server point at the original's photo,
 * logo or cover, so a file is removed only once nothing names it any more.
 * Called after the row being changed has let go of it; soft-deleted rows
 * count, since they can come back. When the question itself fails the file
 * is kept: the change is done, and an orphaned file beats a lost one.
 */
export async function fileStillNamed(
  rows: {
    exists(options: { where: Record<string, string>; withDeleted: boolean }): Promise<boolean>;
  },
  column: string,
  fileName: string,
): Promise<boolean> {
  return rows.exists({ where: { [column]: fileName }, withDeleted: true }).catch(() => true);
}
