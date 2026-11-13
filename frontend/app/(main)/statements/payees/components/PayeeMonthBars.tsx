import { MonthBars } from '@/app/components/charts/MonthBars';
import type { PayeeSummary } from '@/app/lib/contracts';

/** Twelve quiet bars: what went to the payee each month, or came from it when nothing went. */
export function PayeeMonthBars({
  summary,
  tone,
}: {
  summary: PayeeSummary;
  tone: string;
}): React.JSX.Element {
  const spends = summary.spentLastYear > 0;
  return (
    <MonthBars
      months={summary.months.map(month => ({
        month: month.month,
        value: spends ? month.spent : month.received,
      }))}
      currency={summary.currency}
      tone={tone}
    />
  );
}
