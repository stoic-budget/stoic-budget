import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { resolveUploadsDir } from '../../../common/utils/uploads.util';
import { TransactionAttachment } from '../../../entities/transaction-attachment.entity';
import { attachmentsDir } from './transaction-attachment-files';

/** An upload is moved in a moment before its row commits; a restore stages its files first. */
const GRACE_MS = 60 * 60 * 1000;
const BATCH = 500;
/** Where unreferenced files wait before they are deleted, one folder per day. */
export const QUARANTINE_SUBDIR = '.attachments-trash';
const QUARANTINE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * A run that would set aside more than this is more likely a wrong database
 * than a real clean-up, and is skipped. The share only counts above a handful
 * of files, or one deleted file of four would block a small install for good.
 */
export const MAX_ORPHANS = 50;
const MAX_ORPHAN_SHARE = 0.2;
const SHARE_APPLIES_ABOVE = 5;

export type SweepResult =
  | { status: 'swept'; quarantined: number; purgedDays: number }
  | { status: 'skipped'; reason: 'no-rows' | 'too-many'; orphans: number; files: number };

/**
 * Sets aside attachment files no row names any more. Rows go with their
 * transaction by a foreign key cascade (a deleted row, a statement deleted with
 * its rows, a reprocess, a workspace removed, an opened version discarded), and
 * no code runs then; this sweep is what frees the disk afterwards.
 *
 * It trusts the database it is connected to, so it is careful: nothing is
 * deleted at once. Unnamed files move to uploads/.attachments-trash/<day>/ and
 * are deleted 30 days later. A run is skipped, with a warning, when the table
 * is empty while the folder holds files, or when it would set aside a large
 * share of them: both look like an instance started against the wrong database
 * with the real uploads volume.
 *
 * The question is "does any row anywhere name this file", so the lookup is not
 * per workspace on purpose: a file still named by any row stays.
 */
@Injectable()
export class TransactionAttachmentSweeperService {
  private readonly logger = new Logger(TransactionAttachmentSweeperService.name);

  constructor(
    @InjectRepository(TransactionAttachment)
    private readonly attachmentRepository: Repository<TransactionAttachment>,
  ) {}

  @Cron('40 3 * * *')
  async sweepNightly(): Promise<void> {
    const result = await this.sweep();
    if (result.status === 'skipped') {
      this.logger.warn(
        `Attachment sweep skipped (${result.reason}): ${result.orphans} of ${result.files} files are named by no row. Check the database this instance uses.`,
      );
    } else if (result.quarantined > 0 || result.purgedDays > 0) {
      this.logger.log(
        `Set aside ${result.quarantined} attachment files no row names; purged ${result.purgedDays} old trash days`,
      );
    }
  }

  async sweep(now = Date.now()): Promise<SweepResult> {
    const dir = attachmentsDir();
    const files: Array<{ name: string; old: boolean }> = [];
    for (const name of await fs.readdir(dir).catch(() => [] as string[])) {
      const stat = await fs.stat(path.join(dir, name)).catch(() => null);
      if (stat?.isFile()) files.push({ name, old: now - stat.mtimeMs > GRACE_MS });
    }
    if (files.length > 0 && (await this.attachmentRepository.count()) === 0) {
      return { status: 'skipped', reason: 'no-rows', orphans: files.length, files: files.length };
    }

    const orphans = await this.unnamed(files.filter(file => file.old).map(file => file.name));
    const tooMany =
      orphans.length > MAX_ORPHANS ||
      (orphans.length > SHARE_APPLIES_ABOVE && orphans.length > files.length * MAX_ORPHAN_SHARE);
    if (tooMany) {
      return {
        status: 'skipped',
        reason: 'too-many',
        orphans: orphans.length,
        files: files.length,
      };
    }

    const day = new Date(now).toISOString().slice(0, 10);
    const trash = path.join(resolveUploadsDir(), QUARANTINE_SUBDIR, day);
    let quarantined = 0;
    if (orphans.length > 0) await fs.mkdir(trash, { recursive: true });
    for (const name of orphans) {
      await fs.rename(path.join(dir, name), path.join(trash, name)).then(
        () => quarantined++,
        () => undefined,
      );
    }
    return { status: 'swept', quarantined, purgedDays: await this.purgeQuarantine(now) };
  }

  /** Of these file names, the ones no attachment row names. */
  private async unnamed(names: string[]): Promise<string[]> {
    const unnamed: string[] = [];
    for (let start = 0; start < names.length; start += BATCH) {
      const batch = names.slice(start, start + BATCH);
      const named = await this.attachmentRepository.find({
        where: { storedFileName: In(batch) },
        select: { id: true, storedFileName: true },
      });
      const kept = new Set(named.map(row => row.storedFileName));
      unnamed.push(...batch.filter(name => !kept.has(name)));
    }
    return unnamed;
  }

  /** Deletes the trash days older than 30 days, by the day in their name. */
  private async purgeQuarantine(now: number): Promise<number> {
    const root = path.join(resolveUploadsDir(), QUARANTINE_SUBDIR);
    let purged = 0;
    for (const day of await fs.readdir(root).catch(() => [] as string[])) {
      const taken = Date.parse(`${day}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(taken)) continue;
      if (now - taken > QUARANTINE_DAYS * DAY_MS) {
        await fs.rm(path.join(root, day), { recursive: true, force: true });
        purged++;
      }
    }
    return purged;
  }
}
