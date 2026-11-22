import { BadRequestException } from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';
import { type Transaction, TransferPairKind } from '../../../entities/transaction.entity';

/**
 * A balance adjustment is a one-leg pair: the pair is what keeps it out of
 * spending. Splitting it would leave only the first part paired, and
 * unlinking it would turn all of it into spending; deleting it is the undo.
 */
const isAdjustment = (row: Pick<Transaction, 'transferPairKind'>) =>
  row.transferPairKind === TransferPairKind.ADJUSTMENT;

/** Before a split: not split already, and not a balance adjustment. */
export function assertSplitAllowed(row: Pick<Transaction, 'splitGroupId' | 'transferPairKind'>) {
  if (row.splitGroupId) {
    throw new BadRequestException(appError('TRANSACTION_ALREADY_SPLIT'));
  }
  if (isAdjustment(row)) {
    throw new BadRequestException(appError('TRANSACTION_SPLIT_ADJUSTMENT'));
  }
}

/**
 * Before editing: an adjustment takes no category and no tax mark. Either would
 * put it in the tax figures and the ledger's profit and loss; the database
 * clears them anyway (trigger TRG_transactions_adjustment_uncategorised).
 */
export function assertEditAllowed(
  row: Pick<Transaction, 'transferPairKind'>,
  dto: { categoryId?: string | null; taxRelevant?: boolean | null },
) {
  if (isAdjustment(row) && (dto.categoryId || dto.taxRelevant)) {
    throw new BadRequestException(appError('TRANSACTION_ADJUSTMENT_CATEGORY'));
  }
}

/** Before unlinking a transfer: a pair, and not a balance adjustment. */
export function assertUnlinkAllowed(row: Pick<Transaction, 'transferPairId' | 'transferPairKind'>) {
  if (!row.transferPairId) {
    throw new BadRequestException(appError('TRANSACTION_NOT_TRANSFER'));
  }
  if (isAdjustment(row)) {
    throw new BadRequestException(appError('TRANSACTION_UNLINK_ADJUSTMENT'));
  }
}
