import { BadRequestException } from '@nestjs/common';
import { appError } from '../../common/errors/app-error';
import { accountFor, type DatevChart } from './datev-accounts';

const ACCOUNT_PATTERN = /^[0-9]{1,9}$/;

/** Every account a bank account is mapped to is a DATEV account number. */
export function assertBankAccounts(bankAccounts: Record<string, string>): void {
  for (const account of Object.values(bankAccounts)) {
    if (!ACCOUNT_PATTERN.test(account)) {
      throw new BadRequestException(appError('DATEV_BANK_ACCOUNT_INVALID'));
    }
  }
}

/**
 * The bank account kept for a chart. The other chart's bank is never this
 * chart's (1200, the bank in SKR 03, is receivables in SKR 04; 1800, the bank
 * in SKR 04, is private withdrawals in SKR 03): left at it — after a chart
 * switch, or saved so before this rule — the chart's own bank applies.
 */
export function bankForChart(bankAccount: string | null, chart: DatevChart): string | null {
  const other: DatevChart = chart === '03' ? '04' : '03';
  return bankAccount === accountFor('bank', other) ? null : bankAccount;
}
