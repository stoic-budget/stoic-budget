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
 * The bank account kept on a chart change. The old chart's own bank (1200 in
 * SKR 03) is another account in the new one (receivables in SKR 04): left at
 * it, the new chart's bank applies. A number typed in by hand stays.
 */
export function bankAfterChartChange(
  bankAccount: string | null,
  from: DatevChart,
  to: DatevChart,
): string | null {
  return from !== to && bankAccount === accountFor('bank', from) ? null : bankAccount;
}
