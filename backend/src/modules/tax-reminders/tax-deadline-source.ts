import type { Workspace } from '../../entities/workspace.entity';

export interface TaxDeadline {
  kind: 'vat_return' | 'income_tax';
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  daysLeft: number;
  /** Filed (VAT) or finalized (income tax) in the app, or marked as filed outside it. */
  done: boolean;
  /** The user said this return was filed outside Seneca. */
  filedElsewhere: boolean;
  returnName: string;
  /**
   * statute: worked out from the rule in the law; published: the date the
   * authority announced for this year. `checkedAt` is when that was read.
   */
  basis: 'statute' | 'published';
  checkedAt: string;
}

/**
 * Returns the core does not know about, such as the income tax return of the
 * paid edition, join the deadline list and the reminder sweep through this
 * token. The open-source build lists VAT returns only.
 */
export const TAX_DEADLINE_SOURCE = Symbol('TAX_DEADLINE_SOURCE');

export interface TaxDeadlineSource {
  deadlinesFor(
    workspace: Workspace,
    country: string,
    today: string,
    holidays: ReadonlySet<string>,
  ): Promise<TaxDeadline[]>;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
