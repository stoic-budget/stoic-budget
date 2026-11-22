import Link from 'next/link';
import { PrivateAmount } from '@/app/components/ui/private-amount';

export type AmountLine = {
  key: string;
  name: React.ReactNode;
  /** Its own page; null for a line that has none. */
  href: string | null;
  amount: number;
};

/**
 * A titled card of named amounts, largest first, each linking to its own
 * page: where a category's or a tag's money went.
 */
export function AmountList({
  title,
  lines,
  money,
}: {
  title: React.ReactNode;
  lines: AmountLine[];
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
