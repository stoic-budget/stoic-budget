'use client';

import Skeleton from '@mui/material/Skeleton';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { categoryTones } from '@/app/components/charts/chart-theme';
import {
  MonthBars,
  MonthBarsSkeleton,
  monthBounds,
  monthLabel,
} from '@/app/components/charts/MonthBars';
import { CategoryIconBadge } from '@/app/components/dashboard/CategoryIconBadge';
import { Breadcrumbs } from '@/app/components/ui/breadcrumbs';
import { LoadError } from '@/app/components/ui/load-error';
import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { FilteredTransactions } from '../../statements/transactions/components/FilteredTransactions';
import { CategoryBreakdown } from '../components/CategoryBreakdown';
import { CategoryFigures } from '../components/CategoryFigures';
import { useCategory, useCategorySummary } from '../hooks/useCategoryDetail';

/**
 * One category: its last twelve months with subcategories included, counted
 * as the reports count it, where the money went, and its rows. A month bar
 * narrows the rows to that month.
 */
export default function CategoryPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const t = useIntlayer('categoryPage');
  const { locale } = useLocale();
  const category = useCategory(id);
  const summary = useCategorySummary(id);
  const [month, setMonth] = useState<string | null>(null);

  const data = category.data;
  const info = summary.data;
  const money = (value: number) => formatMoney(value, info?.currency ?? 'EUR', locale);
  const name = data ? getCategoryDisplayName(data, locale) : undefined;
  const monthName = month ? monthLabel(month, locale) : '';

  return (
    <div className="seneca-all-tx">
      <Breadcrumbs parent="/categories" current={name} />

      {category.isError && <LoadError>{t.notFound}</LoadError>}
      {category.isPending && (
        <header className="seneca-category-page__header" aria-busy="true">
          <Skeleton variant="circular" width={44} height={44} />
          <Skeleton variant="text" width={240} height={30} />
        </header>
      )}

      {data && (
        <>
          <header className="seneca-category-page__header">
            <CategoryIconBadge name={data.name} icon={data.icon} size={44} />
            <div className="seneca-category-page__title">
              <h1>{name}</h1>
              <span className="seneca-all-tx__muted">
                {data.type === 'income' ? t.income : t.spending}
                {data.parent ? (
                  <>
                    {' · '}
                    {t.partOf}{' '}
                    <Link href={`/categories/${data.parent.id}`} className="seneca-all-tx__link">
                      {getCategoryDisplayName(data.parent, locale)}
                    </Link>
                  </>
                ) : null}
              </span>
            </div>
          </header>

          {info && <CategoryFigures summary={info} money={money} />}
          {info && info.missingRates.length > 0 && (
            <p className="seneca-all-tx__muted" role="status">
              {t.missingRates.value.replace('{{currencies}}', () => info.missingRates.join(', '))}
            </p>
          )}
          {info?.otherDirection && (
            <p className="seneca-all-tx__muted">
              {fillTemplateNodes(
                (info.direction === 'income' ? t.otherSpending : t.otherIncome).value,
                { amount: money(info.otherDirection.amount) },
              )}
            </p>
          )}

          <div className="seneca-all-tx__body" style={{ alignItems: 'stretch' }}>
            <section
              className="seneca-all-tx__card seneca-payees__section"
              style={{ alignContent: 'start' }}
            >
              <h2 className="seneca-all-tx__card-title">{t.monthsTitle}</h2>
              {summary.isError ? (
                <LoadError>{t.loadFailed}</LoadError>
              ) : info ? (
                <MonthBars
                  months={info.months.map(entry => ({ month: entry.month, value: entry.amount }))}
                  currency={info.currency}
                  tone={categoryTones([{ key: data.name }])[0]}
                  selected={month}
                  onSelect={setMonth}
                />
              ) : (
                <MonthBarsSkeleton />
              )}
              <span className="seneca-all-tx__muted seneca-category-page__hint">
                {t.monthsHint}
              </span>
            </section>
            <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
              {info && <CategoryBreakdown categoryId={id} summary={info} money={money} />}
            </div>
          </div>

          <FilteredTransactions
            filter={{
              categoryId: id,
              subcategories: '1',
              ...(month ? monthBounds(month) : {}),
            }}
            title={
              month
                ? t.monthTransactions.value.replace('{{month}}', () => monthName)
                : t.transactionsTitle
            }
            empty={month ? t.noMonthTransactions : t.noTransactions}
            aside={
              month ? (
                <button
                  type="button"
                  className="seneca-category-page__clear"
                  onClick={() => setMonth(null)}
                >
                  {t.showAll}
                </button>
              ) : null
            }
          />
        </>
      )}
    </div>
  );
}
