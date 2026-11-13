'use client';

import Skeleton from '@mui/material/Skeleton';
import { parseISO } from 'date-fns';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { categoryTones } from '@/app/components/charts/chart-theme';
import {
  MonthBars,
  MonthBarsSkeleton,
  monthBounds,
  monthLabel,
} from '@/app/components/charts/MonthBars';
import { Tag } from '@/app/components/icons';
import { Breadcrumbs } from '@/app/components/ui/breadcrumbs';
import { LoadError } from '@/app/components/ui/load-error';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { FilteredTransactions } from '../../statements/transactions/components/FilteredTransactions';
import { TagBreakdown } from '../components/TagBreakdown';
import { TagFigures } from '../components/TagFigures';
import { useTagSummary } from '../hooks/useTagSummary';

/**
 * One tag over all time: what it spent and received, the days it was used,
 * its months, where the money went, and its rows. Counted as Reports' By tag
 * counts it. A month bar narrows the rows to that month.
 */
export default function TagPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const t = useIntlayer('tagPage');
  const tCategory = useIntlayer('categoryPage');
  const tTags = useIntlayer('tagsPage');
  const { locale } = useLocale();
  const summary = useTagSummary(id);
  const [month, setMonth] = useState<string | null>(null);

  const info = summary.data;
  const tag = info?.tag;
  const money = (value: number) => formatMoney(value, info?.currency ?? 'EUR', locale);

  return (
    <div className="seneca-all-tx">
      <Breadcrumbs parent="/tags" current={tag?.name} />

      {summary.isError && <LoadError>{t.notFound}</LoadError>}
      {summary.isPending && (
        <>
          <header className="seneca-category-page__header" aria-busy="true">
            <Skeleton variant="circular" width={44} height={44} />
            <Skeleton variant="text" width={240} height={30} />
          </header>
          <section className="seneca-all-tx__card seneca-payees__section">
            <MonthBarsSkeleton />
          </section>
        </>
      )}

      {info && tag && (
        <>
          <header className="seneca-category-page__header">
            <span className="seneca-tag-page__badge">
              <Tag size={22} aria-hidden />
            </span>
            <div className="seneca-category-page__title">
              <h1>{tag.name}</h1>
              {tag.description || tag.tagDate ? (
                <span className="seneca-all-tx__muted">
                  {tag.description}
                  {tag.description && tag.tagDate ? ' · ' : null}
                  {tag.tagDate ? (
                    <>
                      {tTags.columns.date}: {formatStoredDate(parseISO(tag.tagDate))}
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
          </header>

          <TagFigures summary={info} money={money} />
          {info.missingRates.length > 0 && (
            <p className="seneca-all-tx__muted" role="status">
              {tCategory.missingRates.value.replace('{{currencies}}', () =>
                info.missingRates.join(', '),
              )}
            </p>
          )}

          {info.months.length === 0 ? (
            <p className="seneca-all-tx__muted">{t.nothingCounted}</p>
          ) : (
            <div className="seneca-all-tx__body" style={{ alignItems: 'stretch' }}>
              <section
                className="seneca-all-tx__card seneca-payees__section"
                style={{ alignContent: 'start' }}
              >
                <h2 className="seneca-all-tx__card-title">
                  {info.direction === 'income' ? t.receivedByMonth : t.spentByMonth}
                </h2>
                <MonthBars
                  months={info.months.map(entry => ({ month: entry.month, value: entry.amount }))}
                  currency={info.currency}
                  tone={categoryTones([{ key: tag.name }])[0]}
                  selected={month}
                  onSelect={setMonth}
                />
                <span className="seneca-all-tx__muted seneca-category-page__hint">
                  {tCategory.monthsHint}
                </span>
              </section>
              <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
                <TagBreakdown summary={info} money={money} />
              </div>
            </div>
          )}

          <FilteredTransactions
            filter={{ tagId: id, ...(month ? monthBounds(month) : {}) }}
            title={
              month
                ? tCategory.monthTransactions.value.replace('{{month}}', () =>
                    monthLabel(month, locale),
                  )
                : tCategory.transactionsTitle
            }
            empty={month ? tCategory.noMonthTransactions : t.noTransactions}
            aside={
              month ? (
                <button
                  type="button"
                  className="seneca-category-page__clear"
                  onClick={() => setMonth(null)}
                >
                  {tCategory.showAll}
                </button>
              ) : null
            }
          />
        </>
      )}
    </div>
  );
}
