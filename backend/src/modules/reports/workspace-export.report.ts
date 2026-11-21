import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import type { Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import { Transaction } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { WorkspaceExportFormat } from './dto/workspace-export.dto';
import { logReportGeneration } from './helpers/report-query.util';
import { resolveReportsDir } from './helpers/reports-dir.util';
import {
  generateWorkspaceDocx,
  generateWorkspacePdf,
} from './helpers/workspace-export-pdf-docx.util';
import {
  generateWorkspaceCsv,
  generateWorkspaceExcel,
} from './helpers/workspace-export-writers.util';

/** Every confirmed transaction of a workspace as one Excel, CSV, PDF or Word file. */
@Injectable()
export class WorkspaceExportReport {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly auditService: AuditService,
  ) {}

  async exportWorkspaceTransactions(
    workspaceId: string,
    format: WorkspaceExportFormat,
    viewerMemberId: string | null = null,
  ): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    // A list of rows, not a figure: every confirmed row goes out, crypto moves
    // included — another member's private ones as the list shows them.
    const transactions = await onlyCounted(
      this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.workspaceId = :workspaceId', { workspaceId }),
      'transaction',
    )
      .andWhere('transaction.transferPairId IS NULL')
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.branch', 'branch')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .orderBy('transaction.transactionDate', 'DESC')
      .addOrderBy('transaction.createdAt', 'DESC')
      .getMany();
    redactPrivateRows(transactions, viewerMemberId);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extensionMap: Record<WorkspaceExportFormat, string> = {
      [WorkspaceExportFormat.EXCEL]: 'xlsx',
      [WorkspaceExportFormat.PDF]: 'pdf',
      [WorkspaceExportFormat.CSV]: 'csv',
      [WorkspaceExportFormat.DOCX]: 'docx',
    };
    const mimeTypeMap: Record<WorkspaceExportFormat, string> = {
      [WorkspaceExportFormat.EXCEL]:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      [WorkspaceExportFormat.PDF]: 'application/pdf',
      [WorkspaceExportFormat.CSV]: 'text/csv',
      [WorkspaceExportFormat.DOCX]:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const normalizedFormat = format || WorkspaceExportFormat.EXCEL;
    const fileName = `workspace-transactions-${timestamp}.${extensionMap[normalizedFormat]}`;
    const filePath = path.join(resolveReportsDir(workspaceId), `${randomUUID()}-${fileName}`);

    if (normalizedFormat === WorkspaceExportFormat.EXCEL) {
      await generateWorkspaceExcel(transactions, filePath);
    } else if (normalizedFormat === WorkspaceExportFormat.CSV) {
      await generateWorkspaceCsv(transactions, filePath);
    } else if (normalizedFormat === WorkspaceExportFormat.PDF) {
      await generateWorkspacePdf(transactions, filePath);
    } else {
      await generateWorkspaceDocx(transactions, filePath);
    }

    await logReportGeneration(this.auditService, workspaceId, 'workspace-transactions', 'all-time');

    return {
      filePath,
      fileName,
      mimeType: mimeTypeMap[normalizedFormat],
    };
  }
}
