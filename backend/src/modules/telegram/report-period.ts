import {
  ReportStatus,
  ReportType,
  type TelegramReport,
} from '../../entities/telegram-report.entity';

/**
 * When the period of a report ends: the next day for a daily report, the 1st
 * of the next month for a monthly one. A report sent before then was asked for
 * mid-period and does not stand in for the scheduled one.
 */
export function periodEnd(reportType: ReportType, date: string): Date {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return reportType === ReportType.MONTHLY
    ? new Date(Date.UTC(year, month, 1))
    : new Date(Date.UTC(year, month - 1, day + 1));
}

/** Whether the report reached the user after its period ended: the scheduled one, not a mid-period request. */
export function deliveredAfterPeriod(
  report: Pick<TelegramReport, 'status' | 'sentAt'> | null,
  reportType: ReportType,
  date: string,
): boolean {
  return (
    report?.status === ReportStatus.SENT &&
    !!report.sentAt &&
    report.sentAt >= periodEnd(reportType, date)
  );
}
