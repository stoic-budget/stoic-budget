import { BadRequestException } from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';
import type { UpdateTransactionBody } from '../../../contracts';
import type { Transaction } from '../../../entities/transaction.entity';

/**
 * Refuses edits that would put a filed return out of step with its data.
 *
 * A locked transaction has been reported to a tax authority. Its money and
 * its tax are therefore fixed; everything else about it — comments, wallet,
 * counterparty spelling — stays editable, so locking does not turn the row
 * into a museum piece.
 */
export function assertTaxEditable(
  transaction: Transaction,
  updateDto: UpdateTransactionBody,
): void {
  if (!transaction.taxLocked) {
    return;
  }

  const frozen: Array<keyof UpdateTransactionBody> = [
    'amount',
    'debit',
    'credit',
    'amountForeign',
    'exchangeRate',
    'transactionType',
    'categoryId',
    'transactionDate',
    // Changing it would re-convert the tax at a different rate than the one
    // the filed figure was built from.
    'currency',
  ];

  const attempted = frozen.filter(field => updateDto[field] !== undefined);
  if (attempted.length > 0) {
    throw new BadRequestException(
      appError('TRANSACTION_TAX_LOCKED_FIELDS', { fields: attempted.join(', ') }),
    );
  }
}
