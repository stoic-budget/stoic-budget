import { AmountList } from '@/app/components/ui/amount-list';
import { useIntlayer } from '@/app/i18n';
import type { CategorySummary } from '@/app/lib/contracts';
import { useCategoryName } from '@/app/lib/use-category-name';

/**
 * Where the category's money went over the twelve months: by subcategory, when
 * it has some, and by payee. Each card shows only when it has a line.
 */
export function CategoryBreakdown({
  categoryId,
  summary,
  money,
}: {
  categoryId: string;
  summary: CategorySummary;
  money: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('categoryPage');
  const categoryName = useCategoryName();
  return (
    <>
      {summary.subcategories.length > 0 && (
        <AmountList
          title={t.subcategoriesTitle}
          money={money}
          lines={summary.subcategories.map(entry =>
            entry.id === categoryId
              ? { key: entry.id, name: t.ownRows, href: null, amount: entry.amount }
              : {
                  key: entry.id,
                  name: categoryName(entry.name),
                  href: `/categories/${entry.id}`,
                  amount: entry.amount,
                },
          )}
        />
      )}
      {summary.topPayees.length > 0 && (
        <AmountList
          title={t.payeesTitle}
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
