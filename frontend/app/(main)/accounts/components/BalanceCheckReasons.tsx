import Link from 'next/link';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { BalanceCheckReason } from '@/app/lib/contracts';
import { usePayeeName } from '@/app/lib/use-payee-name';
import { figureStyle, formatDay, mutedStyle } from './account-detail-styles';

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);

const linkStyle = { fontSize: 13, color: 'var(--primary)', justifySelf: 'start' } as const;

/** Where a difference with the bank probably is, each with the place to fix it. */
export function BalanceCheckReasons({
  reasons,
  date,
  money,
}: {
  reasons: readonly BalanceCheckReason[];
  /** The day checked. */
  date: string;
  /** An amount in the account's currency, as the person reads it. */
  money: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('accountBalanceCheck');

  if (reasons.length === 0) {
    return <p style={{ ...mutedStyle, margin: 0 }}>{t.noReasons}</p>;
  }
  return (
    <section style={{ display: 'grid', gap: 12 }} aria-label={t.reasonsTitle.value}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
        {t.reasonsTitle}
      </h3>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
        {reasons.map(reason => (
          <ReasonItem
            key={reason.kind === 'statement_gap' ? `gap-${reason.from}` : reason.kind}
            reason={reason}
            date={date}
            money={money}
          />
        ))}
      </ul>
    </section>
  );
}

function ReasonItem({
  reason,
  date,
  money,
}: {
  reason: BalanceCheckReason;
  date: string;
  money: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('accountBalanceCheck');
  const { locale } = useLocale();
  const payeeName = usePayeeName();
  const day = (value: string) => formatDay(value, locale);
  switch (reason.kind) {
    case 'unconverted':
      return (
        <li style={{ display: 'grid', gap: 4 }}>
          <span style={mutedStyle}>
            {fill(t.reasonUnconverted.value, { currencies: reason.currencies.join(', ') })}
          </span>
          <Link href="/settings/profile" style={linkStyle}>
            {t.addRate}
          </Link>
        </li>
      );
    case 'in_review':
    case 'duplicates':
      return (
        <li style={{ display: 'grid', gap: 4 }}>
          <span style={mutedStyle}>
            {fillTemplateNodes(
              fill(
                reason.kind === 'in_review' ? t.reasonInReview.value : t.reasonDuplicates.value,
                { count: String(reason.count) },
              ),
              { amount: money(reason.amount) },
            )}
          </span>
          <Link
            href={reason.kind === 'in_review' ? '/review' : '/review?kind=duplicate'}
            style={linkStyle}
          >
            {t.openReview}
          </Link>
        </li>
      );
    case 'booked_later':
      return (
        <li style={{ display: 'grid', gap: 4 }}>
          <span style={mutedStyle}>{fill(t.reasonBookedLater.value, { date: day(date) })}</span>
          {reason.rows.map(row => (
            <span
              key={row.id}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
            >
              <span style={{ ...mutedStyle, minWidth: 0 }}>
                {day(row.date)} · {payeeName(row.payee)}
              </span>
              <span style={figureStyle}>
                <PrivateAmount>{money(row.amount)}</PrivateAmount>
              </span>
            </span>
          ))}
          <Link
            href={`/statements/transactions?month=${reason.rows[0]?.date.slice(0, 7) ?? date.slice(0, 7)}`}
            style={linkStyle}
          >
            {t.openRows}
          </Link>
        </li>
      );
    case 'statement_gap':
      return (
        <li style={{ display: 'grid', gap: 4 }}>
          <span style={mutedStyle}>
            {fill(t.reasonGap.value, { from: day(reason.from), to: day(reason.to) })}
          </span>
          <Link href="/statements" style={linkStyle}>
            {t.addStatement}
          </Link>
        </li>
      );
  }
}
