import Link from 'next/link';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { CategorySummary } from '@/app/lib/contracts';
import { useCategoryName } from '@/app/lib/use-category-name';

type Line = { key: string; name: React.ReactNode; href: string | null; amount: number };

/** A titled card of named amounts, largest first, each linking to its own page. */
function AmountList({
  title,
  lines,
  money,
}: {
  title: React.ReactNode;
  lines: Line[];
  money: (value: number) => string;
}): React.JSX.Element {
  return (
    <section className="seneca-all-tx__card seneca-payees__section">
      <h2 className="seneca-all-tx__card-title">{title}</h2>
      <ul className="seneca-category-page__lines">
        {lines.map(line => (
          <li key={line.key} className="seneca-category-page__line">
            {line.href ? (
              <Link href={line.href} className="seneca-all-tx__link">
                {line.name}
              </Link>
            ) : (
              <span className="seneca-all-tx__muted">{line.name}</span>
            )}
            <PrivateAmount className="seneca-category-page__amount">
              {money(line.amount)}
            </PrivateAmount>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
