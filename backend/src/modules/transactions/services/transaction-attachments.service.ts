import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { removeUploadedFile } from '../../../common/utils/file-validator.util';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import { Transaction } from '../../../entities/transaction.entity';
import { TransactionAttachment } from '../../../entities/transaction-attachment.entity';
import {
  assertAttachmentFile,
  attachmentsDir,
  displayFileName,
  insideUploads,
  newStoredFileName,
  servedMimeType,
  sha256Of,
  storedAttachmentPath,
} from './transaction-attachment-files';

export interface AttachmentDownload {
  absolutePath: string;
  fileName: string;
  mimeType: string;
}

/** Who asks, and about which row: the workspace, and the member for private rows. */
export interface AttachmentScope {
  workspaceId: string;
  viewerMemberId: string | null;
}

/**
 * ponytail: files go to local disk, like avatars and custom-field icons already do.
 * That means a multi-instance deploy needs a shared volume — swap the fs calls
 * for the S3/WebDAV services if the app ever runs without one.
 *
 * Another member's private row is "not found" here, as it is for notes: its
 * files say what the row was as plainly as its merchant does.
 */
@Injectable()
export class TransactionAttachmentsService {
  private readonly logger = new Logger(TransactionAttachmentsService.name);

  constructor(
    @InjectRepository(TransactionAttachment)
    private readonly attachmentRepository: Repository<TransactionAttachment>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async list(transactionId: string, scope: AttachmentScope): Promise<TransactionAttachment[]> {
    await this.assertReadable(transactionId, scope);
    return this.attachmentRepository.find({
      where: { transactionId, workspaceId: scope.workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Multer has written the upload to the uploads dir under a random name; it is
   * checked there and moved in, or deleted.
   */
  async create(
    transactionId: string,
    scope: AttachmentScope & { userId: string },
    file: Express.Multer.File,
  ): Promise<TransactionAttachment> {
    try {
      assertAttachmentFile(file);
      await this.assertReadable(transactionId, scope);
      return await this.store(transactionId, scope, file);
    } finally {
      // Moved in: the temporary name is gone and this is a no-op. Refused: it goes.
      if (file?.path) await removeUploadedFile(file);
    }
  }

  /**
   * A copy the server makes itself (an approved receipt's image onto its bank
   * row), from bytes in memory. The approver already holds the row, so only
   * the workspace is checked; the type list applies all the same.
   */
  async attachFromServer(
    transactionId: string,
    workspaceId: string,
    userId: string,
    file: Pick<Express.Multer.File, 'originalname' | 'mimetype' | 'size' | 'buffer'>,
  ): Promise<TransactionAttachment> {
    assertAttachmentFile(file as Express.Multer.File);
    const exists = await this.transactionRepository.exists({
      where: { id: transactionId, workspaceId },
    });
    if (!exists) throw new NotFoundException(appError('TRANSACTION_NOT_FOUND'));
    return this.store(transactionId, { workspaceId, userId }, file as Express.Multer.File);
  }

  /** The same file (same bytes) sent twice, at once or later (a double tap, a retry), is one attachment. */
  private store(
    transactionId: string,
    scope: { workspaceId: string; userId: string },
    file: Express.Multer.File,
  ): Promise<TransactionAttachment> {
    return this.attachmentRepository.manager.transaction(async manager => {
      // One upload per row at a time, so the check below and the insert are one step.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `transaction-attachment:${transactionId}`,
      ]);
      const repository = manager.getRepository(TransactionAttachment);
      const fileName = displayFileName(file.originalname);
      // Same name and size is only a hint; the same bytes is the same file.
      const candidates = await repository.find({
        where: { transactionId, workspaceId: scope.workspaceId, fileName, fileSize: file.size },
      });
      const incoming = candidates.length > 0 ? sha256Of(file.path ?? file.buffer) : null;
      const same = candidates.find(
        row => incoming !== null && sha256Of(storedAttachmentPath(row.storedFileName)) === incoming,
      );
      if (same) return this.asStored(same);
      const storedFileName = newStoredFileName(randomUUID(), file.mimetype);
      const saved = await repository.save(
        repository.create({
          workspaceId: scope.workspaceId,
          transactionId,
          uploadedById: scope.userId,
          fileName,
          storedFileName,
          mimeType: file.mimetype,
          fileSize: file.size,
        }),
      );
      // After the insert: a failed write rolls the row back instead of leaving it fileless.
      fs.mkdirSync(attachmentsDir(), { recursive: true });
      const target = storedAttachmentPath(storedFileName);
      if (file.path) fs.renameSync(insideUploads(file.path), target);
      else fs.writeFileSync(target, file.buffer, { flag: 'wx' });
      return this.asStored(saved);
    });
  }

  async getForDownload(attachmentId: string, scope: AttachmentScope): Promise<AttachmentDownload> {
    const attachment = await this.findReadable(attachmentId, scope);
    const absolutePath = storedAttachmentPath(attachment.storedFileName);

    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException(appError('TRANSACTION_ATTACHMENT_FILE_MISSING'));
    }

    return {
      absolutePath,
      fileName: attachment.fileName,
      mimeType: servedMimeType(attachment.mimeType),
    };
  }

  async remove(attachmentId: string, scope: AttachmentScope): Promise<void> {
    const attachment = await this.findReadable(attachmentId, scope);
    await this.attachmentRepository.remove(attachment);

    // A workspace restored before backups carried these files shares them with
    // its source: the file stays while another row still names it.
    const shared = await this.attachmentRepository.exists({
      where: { storedFileName: attachment.storedFileName, id: Not(attachmentId) },
    });
    if (shared) return;

    try {
      fs.unlinkSync(storedAttachmentPath(attachment.storedFileName));
    } catch (error) {
      // The row is already gone, which is what the user asked for. A leftover blob
      // is a cleanup problem (the nightly sweep takes it), not a failed request.
      this.logger.warn(
        `Deleted attachment ${attachmentId} but could not remove its file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** bigint: a read answers it as a string, so the upload answers the same. */
  private asStored(row: TransactionAttachment): TransactionAttachment {
    row.fileSize = String(row.fileSize) as unknown as number;
    return row;
  }

  private async findReadable(
    attachmentId: string,
    scope: AttachmentScope,
  ): Promise<TransactionAttachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, workspaceId: scope.workspaceId },
    });

    if (!attachment) {
      throw new NotFoundException(appError('TRANSACTION_ATTACHMENT_NOT_FOUND'));
    }
    await this.assertReadable(attachment.transactionId, scope, 'TRANSACTION_ATTACHMENT_NOT_FOUND');
    return attachment;
  }

  private async assertReadable(
    transactionId: string,
    { workspaceId, viewerMemberId }: AttachmentScope,
    code: 'TRANSACTION_NOT_FOUND' | 'TRANSACTION_ATTACHMENT_NOT_FOUND' = 'TRANSACTION_NOT_FOUND',
  ): Promise<void> {
    const row = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
      select: { id: true, isPrivate: true, ownerMemberId: true },
    });

    if (!(row && canReadPrivate(row, viewerMemberId))) {
      throw new NotFoundException(appError(code));
    }
  }
}
