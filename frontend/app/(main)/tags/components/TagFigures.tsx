import { parseISO } from 'date-fns';
import { Figures } from '@/app/components/ui/figures';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { TagSummary } from '@/app/lib/contracts';
import { formatStoredDate } from '@/app/lib/user-format-store';

const day = (date: string | null) => (date ? formatStoredDate(parseISO(date)) : '—');

/** Spent, received and net over all time, and the first and last day the tag was used. */
export function TagFigures({
  summary,
  money,
}: {
  summary: TagSummary;
  /** An amount in the summary's currency. */
  money: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('tagPage');
  const amount = (value: number) => <PrivateAmount>{money(value)}</PrivateAmount>;
  return (
    <Figures
      figures={[
        { key: 'spent', label: t.spent, value: amount(summary.spent) },
        { key: 'received', label: t.received, value: amount(summary.received) },
        { key: 'net', label: t.net, value: amount(summary.net) },
        { key: 'first', label: t.firstUsed, value: day(summary.firstDate) },
        { key: 'last', label: t.lastUsed, value: day(summary.lastDate) },
      ]}
    />
  );
}
