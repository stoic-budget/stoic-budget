'use client';

import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { creditLimitState } from '../credit-limit';
import type { Account } from '../hooks/useAccounts';

/**
 * A credit card's room: "Available €3,800 of €5,000" over a thin bar of what
 * is owed, or "Over the limit by €200" in the overrun tone. Nothing without a
 * limit. Amounts follow privacy mode; the limit is never added to a total.
 */
export function AccountCreditLimit({
  account,
  barWidth,
  flagUnconverted = false,
}: {
  account: Pick<Account, 'type' | 'balance' | 'creditLimit' | 'currency' | 'unconvertedCurrencies'>;
  /** The bar's widest extent; it fills its column when omitted. */
  barWidth?: number;
  /**
   * Where the page does not say it already (the Accounts list): a dot when rows
   * without an exchange rate are left out of the balance, so of the figure too.
   */
  flagUnconverted?: boolean;
}): React.JSX.Element | null {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const state = creditLimitState(account);
  if (!state) {
    return null;
  }
  const money = (value: number) => formatMoney(value, account.currency, locale);
  const tone = state.over === null ? 'var(--primary)' : 'var(--money-down)';
  const unconverted =
    flagUnconverted && account.unconvertedCurrencies.length > 0
      ? t.unconvertedNote.value.replace('{{list}}', account.unconvertedCurrencies.join(', '))
      : null;

  return (
    <span style={{ display: 'grid', gap: 4, width: '100%', maxWidth: barWidth }}>
      <span
        role="progressbar"
        aria-label={t.creditUsed.value}
        aria-valuenow={Math.round(state.usedShare * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          display: 'block',
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
          background: 'var(--icon-badge-bg)',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${state.usedShare * 100}%`,
            height: '100%',
            borderRadius: 2,
            background: tone,
          }}
        />
      </span>
      <span
        title={unconverted ?? undefined}
        style={{
          fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
          color: state.over === null ? 'var(--text-muted)' : 'var(--money-down)',
        }}
      >
        {unconverted && (
          <span
            role="img"
            aria-label={unconverted}
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              marginRight: 6,
              borderRadius: '50%',
              background: 'var(--attention)',
              verticalAlign: 'middle',
            }}
          />
        )}
        {state.over === null
          ? fillTemplateNodes(t.creditAvailable.value, {
              amount: money(state.available),
              limit: money(state.limit),
            })
          : fillTemplateNodes(t.creditOverLimit.value, { amount: money(state.over) })}
      </span>
    </span>
  );
}
