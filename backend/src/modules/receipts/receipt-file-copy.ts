import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Logger } from '@nestjs/common';
import type { Receipt } from '../../entities/receipt.entity';
import type { TransactionAttachmentsService } from '../transactions/services/transaction-attachments.service';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

function mimeTypeOf(fileName: string): string {
  return MIME_BY_EXTENSION[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
}

/** Copies a receipt's file onto the transaction it was attached to; a failure is logged, not thrown. */
export async function copyFileToTransaction(
  attachmentsService: TransactionAttachmentsService | undefined,
  logger: Logger,
  receipt: Receipt,
  transactionId: string,
  userId: string | undefined,
): Promise<void> {
  const filePath = receipt.attachmentPaths?.[0];
  if (!(filePath && userId && attachmentsService)) {
    return;
  }
  try {
    const buffer = await fs.readFile(filePath);
    const originalname = path.basename(filePath);
    await attachmentsService.attachFromServer(transactionId, receipt.workspaceId, userId, {
      originalname,
      mimetype: mimeTypeOf(originalname),
      size: buffer.length,
      buffer,
    });
  } catch (error) {
    logger.warn(
      `Could not attach receipt ${receipt.id} file to transaction ${transactionId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
