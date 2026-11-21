import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { CategorySummary } from '@/app/lib/contracts';

/** This month, the usual month and the year: the three figures over the bars. */
export function CategoryFigures({
  summary,
  money,
}: {
  summary: CategorySummary;
  /** An amount in the summary's currency. */
  money: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('categoryPage');
  const figures = [
    { key: 'month', label: t.thisMonth, value: summary.thisMonth, hint: undefined },
    {
      key: 'average',
      label: t.average,
      value: summary.averagePerMonth,
      hint: t.averageHint.value,
    },
    { key: 'year', label: t.lastYear, value: summary.lastYearTotal, hint: undefined },
  ];
  return (
    <div className="seneca-payees__figures">
      {figures.map(figure => (
        <div key={figure.key} title={figure.hint}>
          <span className="seneca-payees__figure-label">{figure.label}</span>
          <span className="seneca-payees__figure-value">
            {figure.value === null ? '—' : <PrivateAmount>{money(figure.value)}</PrivateAmount>}
          </span>
        </div>
      ))}
    </div>
  );
}
