import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { isDebtType } from '../account-types';
import type { Account } from '../hooks/useAccounts';
import { formatDay, mutedStyle } from './account-detail-styles';

/** Whether the books agree with the bank, said once, under the balance. */
export function AccountReconciliation({ account }: { account: Account }): React.JSX.Element | null {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const reconciliation = account.reconciliation;
  if (account.pendingReviewCount > 0) {
    return (
      <span style={mutedStyle}>
        {t.pendingReview.value.replace('{{count}}', String(account.pendingReviewCount))}
      </span>
    );
  }
  if (!reconciliation) {
    return null;
  }
  const dot = (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: reconciliation.matches ? 'var(--money-up)' : 'var(--attention)',
      }}
    />
  );
  return (
    <span style={{ ...mutedStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {dot}
      <span>
        {reconciliation.matches
          ? t.matches.value.replace('{{date}}', formatDay(reconciliation.date, locale))
          : fillTemplateNodes(t.mismatch.value, {
              amount: formatMoney(
                Math.abs(reconciliation.statementBalance - reconciliation.computedBalance),
                account.currency,
                locale,
              ),
            })}
      </span>
    </span>
  );
}

/**
 * The last time the person held the balance against the bank's and it
 * matched; said quietly, and said again if a row changed since undid it.
 */
export function AccountBalanceCheckNote({
  account,
}: {
  account: Account;
}): React.JSX.Element | null {
  const t = useIntlayer('accountBalanceCheck');
  const { locale } = useLocale();
  const check = account.balanceCheck;
  if (!check) {
    return null;
  }
  const date = formatDay(check.date, locale);
  return (
    <span
      style={{ ...mutedStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}
      data-testid="balance-check-note"
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          background: check.stillMatches ? 'var(--money-up)' : 'var(--attention)',
        }}
      />
      <span>
        {check.stillMatches
          ? t.checkedNote.value.replace('{{date}}', () => date)
          : fillTemplateNodes(
              t.checkedStale.value.replace('{{date}}', () => date),
              {
                amount: formatMoney(
                  isDebtType(account.type) ? -check.bankBalance : check.bankBalance,
                  account.currency,
                  locale,
                ),
              },
            )}
      </span>
    </span>
  );
}
