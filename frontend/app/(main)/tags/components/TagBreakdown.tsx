import { AmountList } from '@/app/components/ui/amount-list';
import { useIntlayer } from '@/app/i18n';
import type { TagSummary } from '@/app/lib/contracts';
import { useCategoryName } from '@/app/lib/use-category-name';

/**
 * Where the tag's money went (or came from, for a tag that mostly received):
 * by category, a row without one on its own line, and by payee. Each card
 * shows only when it has a line.
 */
export function TagBreakdown({
  summary,
  money,
}: {
  summary: TagSummary;
  money: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('tagPage');
  const tCategory = useIntlayer('categoryPage');
  const tAll = useIntlayer('allTransactionsPage');
  const categoryName = useCategoryName();
  return (
    <>
      {summary.categories.length > 0 && (
        <AmountList
          title={t.categoriesTitle}
          money={money}
          lines={summary.categories.map(entry =>
            entry.id && entry.name
              ? {
                  key: entry.id,
                  name: categoryName(entry.name),
                  href: `/categories/${entry.id}`,
                  amount: entry.amount,
                }
              : {
                  key: entry.id ?? 'none',
                  name: tAll.uncategorized,
                  href: null,
                  amount: entry.amount,
                },
          )}
        />
      )}
      {summary.topPayees.length > 0 && (
        <AmountList
          title={tCategory.payeesTitle}
          money={money}
          lines={summary.topPayees.map(payee => ({
            key: payee.id,
            name: payee.name,
            href: `/statements/payees/${payee.id}`,
            amount: payee.amount,
          }))}
        />
      )}
    </>
  );
}
