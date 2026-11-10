import { PendingBadge } from '@/app/components/transactions/PendingBadge';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { usePayeeName } from '@/app/lib/use-payee-name';
import type { useAccount } from '../hooks/useAccounts';
import {
  cardStyle,
  figureStyle,
  formatDay,
  listRowStyle,
  mutedStyle,
  titleStyle,
} from './account-detail-styles';

/** The account's latest rows, each with the balance after it. */
export function AccountTransactionsCard({
  transactions,
  money,
}: {
  transactions: ReturnType<typeof useAccount>['transactions'];
  /** An amount in the account's currency. */
  money: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('accountsPage');
  const payeeName = usePayeeName();
  const { locale } = useLocale();
  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>{t.transactionsTitle}</h2>
      {transactions.length === 0 ? (
        <span style={mutedStyle}>{t.noTransactions}</span>
      ) : (
        <div>
          {transactions.map(row => {
            const amount = Number(row.credit ?? 0) - Number(row.debit ?? 0);
            const other = row.transferPairWallet?.name;
            return (
              <div key={row.id} style={listRowStyle}>
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 14,
                      // A pending row is in the muted ink: it counts nowhere until it books.
                      color: row.isPending ? 'var(--text-muted)' : 'var(--foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {other
                      ? t.transferWith.value.replace('{{account}}', other)
                      : payeeName(row.counterpartyName)}
                  </span>
                  <span style={mutedStyle}>
                    {formatDay(row.transactionDate, locale)}
                    {row.isPending ? <PendingBadge /> : null}
                  </span>
                </span>
                <span style={{ display: 'grid', gap: 2, justifyItems: 'end' }}>
                  <span
                    style={
                      row.isPending ? { ...figureStyle, color: 'var(--text-muted)' } : figureStyle
                    }
                  >
                    <PrivateAmount>{formatMoney(amount, row.currency, locale)}</PrivateAmount>
                  </span>
                  {row.runningBalance && (
                    <span style={{ ...mutedStyle, fontVariantNumeric: 'tabular-nums' }}>
                      <PrivateAmount>{money(Number(row.runningBalance))}</PrivateAmount>
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
