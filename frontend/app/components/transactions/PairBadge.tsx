import { useIntlayer } from '@/app/i18n';
import type { Transaction } from './types';

/** What a paired row is, said once above its actions: a transfer, a refund, an investment, a balance adjustment. */
export function PairBadge({ transaction }: { transaction: Transaction }): React.JSX.Element | null {
  const t = useIntlayer('transactionsDrawer');
  const tCheck = useIntlayer('accountBalanceCheck');
  if (!transaction.transferPairId) {
    return null;
  }
  const label = {
    investment:
      transaction.transactionType === 'income'
        ? t.investment.withdrawalBadge.value
        : t.investment.badge.value,
    reimbursement: t.reimbursement.badge.value,
    adjustment: tCheck.payee.value,
    transfer: t.transfer.badge.value,
  }[transaction.transferPairKind ?? 'transfer'];
  return (
    <div className="seneca-tx-detail__cat-badge" data-testid="transfer-badge">
      {label}
    </div>
  );
}
