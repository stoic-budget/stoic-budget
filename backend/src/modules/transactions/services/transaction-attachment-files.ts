import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';
import { validateFile } from '../../../common/utils/file-validator.util';
import { sanitizeArchiveEntryName } from '../../../common/utils/filename.util';
import { resolveUploadsDir } from '../../../common/utils/uploads.util';

/** Subdirectory of the uploads dir that holds every transaction attachment. */
export const ATTACHMENTS_SUBDIR = 'transaction-attachments';

/**
 * What a row may carry: a photo or a PDF, the receipt kinds minus e-invoice XML.
 * The phone's camera, a scan and a PDF invoice all land here; anything a browser
 * could run (HTML, SVG, XML) does not.
 */
export const ATTACHMENT_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'application/pdf',
]);

/** Same ceiling as every other upload (validateFile, multerConfig). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Where the files live. Read-only: nothing is created here, see ensureAttachmentsDir. */
export function attachmentsDir(): string {
  return path.join(resolveUploadsDir(), ATTACHMENTS_SUBDIR);
}

/** An upload's temp path, resolved and refused unless it sits inside the uploads directory. */
export function insideUploads(filePath: string): string {
  const root = path.resolve(resolveUploadsDir());
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('File is outside the uploads directory');
  }
  return resolved;
}

/** The path of a stored file. basename(): a stored name is generated, but never trusted. */
export function storedAttachmentPath(storedFileName: string): string {
  return path.join(attachmentsDir(), path.basename(storedFileName));
}

/** The name on disk: random, with an extension taken from the checked type, not the upload. */
export function newStoredFileName(id: string, mimeType: string): string {
  const extension: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'application/pdf': '.pdf',
  };
  return `${id}${extension[mimeType] ?? '.bin'}`;
}

// Bidirectional overrides make "gpj.exe" read as "exe.jpg"; they have no place in a file name.
const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩]/g;

/**
 * Multer reads a multipart file name as latin1, so a UTF-8 "März.pdf" arrives
 * as "MÃ¤rz.pdf". Read back as UTF-8 when the bytes make valid UTF-8; a name
 * that does not (or was never multipart) stays as it is.
 */
function utf8FromLatin1(name: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the latin1 range is the point
  if (!/[\u0080-\u00ff]/.test(name) || /[^\u0000-\u00ff]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

/** The name people see: its last segment, no control characters, at most 255 characters. */
export function displayFileName(originalName: string | undefined): string {
  const cleaned = sanitizeArchiveEntryName(utf8FromLatin1(originalName ?? ''))
    .replace(BIDI_CONTROLS, '')
    .trim();
  return (cleaned || 'file').slice(0, 255);
}

/**
 * Refuses anything but a photo or a PDF whose first bytes agree with its type.
 * validateFile does the size and signature check (multer wrote the file to
 * disk, so its bytes are read); the narrower list is checked here.
 */
export function assertAttachmentFile(file: Express.Multer.File | undefined): void {
  validateFile(file as Express.Multer.File);
  if (!ATTACHMENT_MIME_TYPES.has(file?.mimetype ?? '')) {
    throw new BadRequestException(appError('TRANSACTION_ATTACHMENT_TYPE_UNSUPPORTED'));
  }
}

/**
 * The type a download is served as: the stored one when it is on the list,
 * otherwise bytes. Rows from before the list existed could say anything.
 */
export function servedMimeType(mimeType: string): string {
  return ATTACHMENT_MIME_TYPES.has(mimeType) ? mimeType : 'application/octet-stream';
}

/** sha256 of bytes in memory, or of a file on disk; null when the file cannot be read. */
export function sha256Of(source: Buffer | string): string | null {
  try {
    const bytes = typeof source === 'string' ? fs.readFileSync(insideUploads(source)) : source;
    return createHash('sha256').update(bytes).digest('hex');
  } catch {
    return null;
  }
}
