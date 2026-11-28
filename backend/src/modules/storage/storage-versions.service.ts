import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import { neutralizeSpreadsheetFormulaCell } from '../../common/utils/spreadsheet-formula.util';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import { FileVersion, Statement, Transaction } from '../../entities';
import { MetricsService } from '../observability/metrics.service';
import { StorageAccessService } from './storage-access.service';

/** A file's versions and bytes: downloads, previews, restore and the CSV of its rows. */
@Injectable()
export class StorageVersionsService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(FileVersion)
    private readonly fileVersionRepository: Repository<FileVersion>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly fileStorageService: FileStorageService,
    private readonly storageAccess: StorageAccessService,
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  async createFileVersion(statementId: string, userId: string) {
    await this.storageAccess.checkFileAccess(userId, statementId, 'edit');

    const statement = await this.statementRepository
      .createQueryBuilder('statement')
      .addSelect('statement.fileData')
      .where('statement.id = :id', { id: statementId })
      .getOne();

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    let fileData = statement.fileData ?? null;

    if (!fileData) {
      const resolved = this.fileStorageService.resolveFilePath(statement.filePath);
      if (resolved) {
        try {
          fileData = await fs.promises.readFile(resolved);
        } catch {
          fileData = null;
        }
      }
    }

    if (!fileData && statement.fileHash && statement.userId) {
      const other = await this.statementRepository
        .createQueryBuilder('statement')
        .addSelect('statement.fileData')
        .where('statement.userId = :userId', { userId: statement.userId })
        .andWhere('statement.fileHash = :fileHash', {
          fileHash: statement.fileHash,
        })
        .andWhere('statement.fileData IS NOT NULL')
        .andWhere('statement.id <> :id', { id: statement.id })
        .orderBy('statement.createdAt', 'DESC')
        .getOne();

      fileData = other?.fileData ?? null;
    }

    if (!fileData) {
      throw new NotFoundException(appError('STORAGE_FILE_DATA_UNAVAILABLE_VERSIONING'));
    }

    const actualHash = crypto.createHash('sha256').update(fileData).digest('hex');
    if (actualHash !== statement.fileHash) {
      throw new BadRequestException(appError('STORAGE_FILE_HASH_MISMATCH'));
    }

    const version = this.fileVersionRepository.create({
      statementId: statement.id,
      createdBy: userId,
      fileHash: statement.fileHash,
      fileName: statement.fileName,
      fileType: statement.fileType,
      fileSize: statement.fileSize,
      fileData,
    });

    const saved = await this.fileVersionRepository.save(version);

    return {
      id: saved.id,
      statementId: saved.statementId,
      createdBy: saved.createdBy,
      fileHash: saved.fileHash,
      fileName: saved.fileName,
      fileType: saved.fileType,
      // bigint: the version list answers it as a string, so this answers the same.
      fileSize: String(saved.fileSize),
      createdAt: saved.createdAt,
    };
  }

  async listFileVersions(statementId: string, userId: string) {
    await this.storageAccess.checkFileAccess(userId, statementId, 'view');

    return await this.fileVersionRepository.find({
      where: { statementId },
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        statementId: true,
        createdBy: true,
        fileHash: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
      },
    });
  }

  /**
   * Download file
   */
  async downloadFile(statementId: string, userId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    const { stream, fileName, mimeType } = await this.getFileStream(statement, userId, 'download');
    return { stream, fileName, mimeType };
  }

  async restoreFile(statementId: string, userId: string) {
    await this.storageAccess.checkFileAccess(userId, statementId, 'edit');
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });
    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }
    const restored = await this.fileStorageService.restoreFile(statement);
    if (!restored) {
      throw new NotFoundException(appError('STORAGE_FILE_DATA_UNAVAILABLE_RESTORE'));
    }
    return { status: 'restored', source: restored.source };
  }

  async exportTransactionsCsv(statementId: string, userId: string) {
    await this.storageAccess.checkFileAccess(userId, statementId, 'view');
    const transactions = await this.transactionRepository.find({
      where: { statementId },
      order: { transactionDate: 'DESC' },
    });
    // As in getFileDetails: a private row reads as a placeholder to all but its owner.
    const workspaceId = transactions[0]?.workspaceId;
    const membership = workspaceId
      ? await this.storageAccess.findMembership(workspaceId, userId)
      : null;
    redactPrivateRows(transactions, membership?.id ?? null);

    const header = [
      'date',
      'documentNumber',
      'counterpartyName',
      'counterpartyBin',
      'debit',
      'credit',
      'currency',
      'paymentPurpose',
    ];
    const rows = transactions.map(t => [
      // The `date` column comes back as a string, not a Date.
      t.transactionDate ? new Date(t.transactionDate).toISOString().split('T')[0] : '',
      t.documentNumber ?? '',
      t.counterpartyName ?? '',
      t.counterpartyBin ?? '',
      t.debit ?? '',
      t.credit ?? '',
      t.currency ?? '',
      (t.paymentPurpose || '').replace(/\n/g, ' '),
    ]);
    const csv = [header, ...rows]
      .map(r =>
        r
          .map(v => `"${String(neutralizeSpreadsheetFormulaCell(v)).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const fileName = `transactions-${statementId}.csv`;
    return { csv, fileName };
  }

  /**
   * Get file info for inline preview
   */
  async getFilePreview(statementId: string, userId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    const started = Date.now();
    try {
      const { stream, fileName, mimeType } = await this.getFileStream(statement, userId, 'view');
      return { stream, fileName, mimeType };
    } catch (error) {
      this.observeFileAccess('view', 'error', started);
      throw error;
    }
  }

  async getSharedDownloadStream(statementId: string): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
  }> {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException(appError('STORAGE_FILE_NOT_FOUND'));
    }

    const started = Date.now();
    try {
      const { stream, fileName, mimeType, source } =
        await this.fileStorageService.getStatementFileStream(statement);
      this.observeFileAccess('shared-download', 'ok', started, source);
      return { stream, fileName, mimeType };
    } catch (error) {
      this.observeFileAccess('shared-download', 'error', started);
      throw error;
    }
  }

  private async getFileStream(
    statement: Statement,
    userId: string,
    action: 'view' | 'download',
  ): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
  }> {
    await this.storageAccess.checkFileAccess(userId, statement.id, action);

    const started = Date.now();
    try {
      const { stream, fileName, mimeType, source } =
        await this.fileStorageService.getStatementFileStream(statement);
      this.observeFileAccess(action, 'ok', started, source);
      return { stream, fileName, mimeType };
    } catch (error) {
      this.observeFileAccess(action, 'error', started);
      throw error;
    }
  }

  private observeFileAccess(
    action: 'view' | 'download' | 'shared-download',
    result: 'ok' | 'error',
    startedAt: number,
    source: 'disk' | 'db' | 'restored' | 'unknown' = 'unknown',
  ) {
    if (!this.metricsService?.storageFileAccessDurationSeconds) {
      return;
    }
    const duration = (Date.now() - startedAt) / 1000;
    this.metricsService.storageFileAccessDurationSeconds.observe(
      { action, source, result },
      duration,
    );
    if (result === 'error' && this.metricsService.storageFileAccessErrorsTotal) {
      this.metricsService.storageFileAccessErrorsTotal.inc({
        action,
        reason: 'access_failed',
      });
    }
  }
}
