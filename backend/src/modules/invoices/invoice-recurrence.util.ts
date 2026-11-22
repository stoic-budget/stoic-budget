import {
  addDays,
  addMonthsClamped,
  daysBetween,
  parseDay,
} from '../../common/recurrence/date-only';
import { InvoiceRecurrenceInterval } from '../../entities/invoice.entity';

/**
 * The next date a recurring invoice's copy should be issued on.
 *
 * Months are added with the day clamped to the target month (a monthly invoice
 * dated 31 January is next issued on 28 February, not 3 March). `anchorDate`
 * is the recurrence's own issue date; pass it when advancing from a date that
 * was already clamped (29 February, a month-end), so the series keeps billing
 * on the day it was set up on.
 */
export function advanceIssueDate(
  issueDate: string,
  interval: InvoiceRecurrenceInterval,
  anchorDate: string = issueDate,
): string {
  const anchorDay = parseDay(anchorDate).getUTCDate();

  switch (interval) {
    case InvoiceRecurrenceInterval.WEEKLY:
      return addDays(issueDate, 7);
    case InvoiceRecurrenceInterval.MONTHLY:
      return addMonthsClamped(issueDate, 1, anchorDay);
    case InvoiceRecurrenceInterval.QUARTERLY:
      return addMonthsClamped(issueDate, 3, anchorDay);
    case InvoiceRecurrenceInterval.YEARLY:
      return addMonthsClamped(issueDate, 12, anchorDay);
  }
}

/** Keeps the same issue-to-due offset (in days) on a generated copy. */
export function shiftDueDate(
  oldIssueDate: string,
  oldDueDate: string,
  newIssueDate: string,
): string {
  return addDays(newIssueDate, daysBetween(oldIssueDate, oldDueDate));
}
