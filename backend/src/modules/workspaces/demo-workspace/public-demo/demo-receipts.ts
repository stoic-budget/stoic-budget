import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { Effect } from 'effect';
import sharp from 'sharp';
import type { DataSource } from 'typeorm';
import type { EffectRuntime } from '../../../../common/effect/effect-runtime';
import { getWith } from '../../../../common/effect/http-json';
import { resolveUploadsDir } from '../../../../common/utils/uploads.util';
import { Category } from '../../../../entities/category.entity';
import { Receipt, ReceiptSource, ReceiptStatus } from '../../../../entities/receipt.entity';
import { StatementStage } from '../../../../entities/statement.entity';
import type { ReceiptsService } from '../../../receipts/receipts.service';
import { addDays } from '../demo-dates';
import { DEMO_RECEIPTS, type DemoReceiptSource } from './demo-receipts.data';

const FOLDER = 'demo-receipts';
const WIDTH = 1000;
/** Wikimedia asks automated clients to name themselves. */
const USER_AGENT = 'demo-seed/1.0 (https://github.com/stoic-budget/stoic-budget)';

export interface DemoReceiptsDeps {
  dataSource: DataSource;
  effects: EffectRuntime;
  receipts: ReceiptsService;
}

/**
 * Files the demo's receipts and books the ones it does not leave for review.
 * An image already on disk is reused, so a nightly reseed downloads nothing; a
 * receipt whose image cannot be fetched or does not match is left out with a
 * warning instead of failing the whole seed.
 */
export async function seedDemoReceipts(
  deps: DemoReceiptsDeps,
  ids: { workspaceId: string; userId: string },
  anchor: string,
): Promise<number> {
  const logger = new Logger('DemoReceipts');
  const folder = path.join(resolveUploadsDir(), FOLDER);
  await mkdir(folder, { recursive: true });
  const categories = await deps.dataSource.getRepository(Category).find({
    where: { workspaceId: ids.workspaceId },
    select: { id: true, name: true },
  });
  let filed = 0;
  for (const source of DEMO_RECEIPTS) {
    const file = path.join(folder, `${source.key}.jpg`);
    if (!(existsSync(file) || (await fetchInto(deps.effects, source, file, logger)))) {
      continue;
    }
    const categoryId = categories.find(category => category.name === source.category)?.id;
    const receipt = await deps.dataSource
      .getRepository(Receipt)
      .save(
        await receiptRow(source, file, ids, addDays(anchor, -source.daysBeforeAnchor), categoryId),
      );
    if (!source.pending) {
      await deps.receipts.approve(receipt.id, ids.workspaceId, ids.userId, { attachTo: null });
    }
    filed += 1;
  }
  return filed;
}

/** Downloads the original, checks it is the reviewed file, and keeps a smaller copy. */
async function fetchInto(
  effects: EffectRuntime,
  source: DemoReceiptSource,
  file: string,
  logger: Logger,
): Promise<boolean> {
  const original = await effects
    .run(
      getWith(
        source.url,
        { timeout: '60 seconds', retry: true, headers: { 'user-agent': USER_AGENT } },
        response =>
          response.status === 200
            ? Effect.map(response.arrayBuffer, body => Buffer.from(body))
            : Effect.succeed(null),
      ),
    )
    .catch(() => null);
  if (!original) {
    logger.warn(`Receipt ${source.key}: download failed, left out`);
    return false;
  }
  if (createHash('sha1').update(original).digest('hex') !== source.sha1) {
    logger.warn(`Receipt ${source.key}: the file changed upstream, left out`);
    return false;
  }
  const resized = await sharp(original)
    .rotate()
    .resize({ width: WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  await writeFile(file, resized);
  return true;
}

async function receiptRow(
  source: DemoReceiptSource,
  file: string,
  ids: { workspaceId: string; userId: string },
  date: string,
  categoryId: string | undefined,
): Promise<Partial<Receipt>> {
  const filename = `${source.key}.jpg`;
  return {
    userId: ids.userId,
    workspaceId: ids.workspaceId,
    source: ReceiptSource.UPLOAD,
    messageId: null,
    subject: filename,
    sender: 'manual-upload',
    receivedAt: new Date(`${date}T12:00:00Z`),
    status: ReceiptStatus.NEEDS_REVIEW,
    stage: StatementStage.SUBMIT,
    attachmentPaths: [file],
    metadata: {
      attachments: [
        { id: filename, filename, mimeType: 'image/jpeg', size: (await stat(file)).size },
      ],
    },
    parsedData: {
      amount: source.totalCents / 100,
      currency: 'EUR',
      vendor: source.vendor,
      ...(source.address ? { merchantAddress: source.address } : {}),
      date,
      category: source.category,
      ...(categoryId ? { categoryId } : {}),
      ...(source.taxCents === null ? {} : { tax: source.taxCents / 100 }),
      lineItems: source.lines.map(line => ({
        description: line.description,
        amount: line.cents / 100,
      })),
      transactionType: 'expense',
      confidence: 1,
    },
    language: 'de',
    extractionMethod: null,
    confidence: 1,
    isDuplicate: false,
  };
}
