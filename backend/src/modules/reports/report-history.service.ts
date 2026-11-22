import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { resolveInUploadsDir } from '../../common/utils/uploads.util';
import { ReportHistory } from '../../entities/report-history.entity';
import { reportsDirOf } from './helpers/reports-dir.util';
import type { ReportFile } from './report-document.util';

/** Generated report files a workspace can list and download again. */
@Injectable()
export class ReportHistoryService {
  constructor(
    @InjectRepository(ReportHistory)
    private readonly reportHistoryRepo: Repository<ReportHistory>,
  ) {}

  async getReportHistory(workspaceId: string): Promise<ReportHistory[]> {
    return this.reportHistoryRepo.find({
      where: { workspaceId },
      order: { generatedAt: 'DESC' },
      take: 50,
      relations: {
        user: true,
      },
    });
  }

  async downloadHistoryReport(workspaceId: string, reportId: string): Promise<ReportFile> {
    const report = await this.reportHistoryRepo.findOne({
      where: { id: reportId, workspaceId },
    });

    // Only a file in this workspace's own directory is served. Rows written
    // before reports moved there point at a shared path that another workspace
    // may have overwritten since, so they read as missing.
    const filePath =
      report?.filePath &&
      resolveInUploadsDir(report.filePath, path.resolve(reportsDirOf(workspaceId)));
    if (!(filePath && report.fileName && fs.existsSync(filePath))) {
      throw new NotFoundException(appError('REPORT_FILE_NOT_FOUND'));
    }

    const format = String(report.format || '').toLowerCase();
    const contentType =
      format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : format === 'csv'
          ? 'text/csv'
          : 'application/pdf';

    return {
      filePath,
      fileName: report.fileName,
      contentType,
    };
  }
}
