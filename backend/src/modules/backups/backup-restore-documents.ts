import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { attachmentsDir } from '../transactions/services/transaction-attachment-files';
import { restoreColumnFile } from './backup-file-columns';

type StagedFile = { stagedPath: string; targetPath: string };

/**
 * Points a restored row at its own copy of every document it carries: written
 * to the restore directory now, moved to its place once the rows are in.
 * Statements and receipts get `restored-<id>-<name>` in the uploads dir; a
 * transaction attachment gets a fresh random name in the attachments dir, so
 * the copy never shares a file with the workspace it came from.
 */
export async function prepareDocumentPaths(
  tableName: string,
  source: Record<string, unknown>,
  mapped: Record<string, unknown>,
  files: Map<string, Buffer>,
  restoreDirectory: string,
  stagedFiles: StagedFile[],
): Promise<void> {
  const stage = (portablePath: string, targetPath: (safeName: string) => string) =>
    stageDocument(portablePath, targetPath, files, restoreDirectory, stagedFiles);
  const restoredCopy = (safeName: string) =>
    path.join(resolveUploadsDir(), `restored-${String(mapped.id)}-${safeName}`);

  if (tableName === 'statements') {
    if (typeof source.filePath === 'string') {
      mapped.filePath = await stage(source.filePath, restoredCopy);
    }
    return;
  }
  if (tableName === 'receipts' && Array.isArray(source.attachmentPaths)) {
    mapped.attachmentPaths = await Promise.all(
      source.attachmentPaths
        .filter((value): value is string => typeof value === 'string')
        .map(portablePath => stage(portablePath, restoredCopy)),
    );
    return;
  }
  if (tableName === 'transaction_attachments' && typeof source.storedFileName === 'string') {
    const target = await stage(source.storedFileName, safeName => {
      // The archive is not trusted to name an extension: letters and digits only.
      const extension = path
        .extname(safeName)
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, '');
      return path.join(attachmentsDir(), `${randomUUID()}${extension.slice(0, 8)}`);
    });
    mapped.storedFileName = path.basename(target);
    return;
  }
  await restoreColumnFile(tableName, source, mapped, stage);
}

async function stageDocument(
  portablePath: string,
  targetPath: (safeName: string) => string,
  files: Map<string, Buffer>,
  restoreDirectory: string,
  stagedFiles: StagedFile[],
): Promise<string> {
  const contents = files.get(portablePath);
  const safeName = path.basename(portablePath);
  const target = targetPath(safeName);
  // A file the backup could not read (#639): the row comes back without it,
  // showing "file missing" as it did before, instead of failing the restore.
  if (!contents) return target;
  const stagedPath = path.join(restoreDirectory, `${randomUUID()}-${safeName}`);
  await fs.writeFile(stagedPath, contents, { flag: 'wx' });
  stagedFiles.push({ stagedPath, targetPath: target });
  return target;
}
