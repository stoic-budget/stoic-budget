'use client';

import { CategoriesFilterField } from '@/app/(main)/custom-tables/components/filter-picker-fields';
import { Search } from '@/app/components/icons';
import { FilterChipButton } from '@/app/components/ui/filter-chip-button';
import { useTags } from '@/app/hooks/useTags';
import { useIntlayer } from '@/app/i18n';
import type { CategoryList } from '@/app/lib/contracts';
import {
  amountOf,
  EMPTY_FILTERS,
  hasFilters,
  type TransactionFilters,
} from '../transaction-filters';
import { DebouncedField } from './DebouncedField';
import { SavedViewsMenu } from './SavedViewsMenu';
import { TagsFilterField } from './TagsFilterField';

const TOGGLES = ['uncategorized', 'untagged', 'noPayee'] as const;

const trimmed = (draft: string) => draft.trim().slice(0, 200);
const amountText = (draft: string) => {
  const amount = amountOf(draft);
  return amount === undefined ? '' : String(amount);
};

/**
 * Narrows the table: text, an amount range, categories, tags and the rows
 * missing a category, a tag or a payee. The pies and month counts stay whole.
 */
export function TransactionFiltersBar({
  filters,
  categories,
  onChange,
}: {
  filters: TransactionFilters;
  categories: CategoryList;
  onChange: (next: TransactionFilters) => void;
}): React.JSX.Element {
  const t = useIntlayer('allTransactionsFilters');
  const tags = useTags();
  const set = (patch: Partial<TransactionFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="seneca-all-tx__filters">
      <div className="seneca-all-tx__filters-search">
        <DebouncedField
          type="search"
          value={filters.q ?? ''}
          normalize={trimmed}
          onCommit={q => set({ q: q || undefined })}
          label={t.search.value}
          startAdornment={<Search size={16} aria-hidden color="var(--text-muted)" />}
          width="100%"
        />
      </div>
      <div className="seneca-all-tx__filters-amounts">
        <DebouncedField
          value={filters.amountMin === undefined ? '' : String(filters.amountMin)}
          normalize={amountText}
          onCommit={value => set({ amountMin: amountOf(value) })}
          label={t.amountMin.value}
          inputMode="decimal"
          width={120}
        />
        <span className="seneca-all-tx__muted" aria-hidden>
          –
        </span>
        <DebouncedField
          value={filters.amountMax === undefined ? '' : String(filters.amountMax)}
          normalize={amountText}
          onCommit={value => set({ amountMax: amountOf(value) })}
          label={t.amountMax.value}
          inputMode="decimal"
          width={120}
        />
      </div>
      <div className="seneca-all-tx__filters-picker">
        <CategoriesFilterField
          label={t.categories.value}
          value={filters.categoryIds}
          categories={categories}
          onChange={categoryIds => set({ categoryIds })}
          anyLabel={t.anyCategory.value}
          emptyLabel={t.anyCategory.value}
          selectedLabel={t.categoriesSelected.value}
        />
      </div>
      <div className="seneca-all-tx__filters-picker">
        <TagsFilterField
          label={t.tags.value}
          value={filters.tagIds}
          tags={tags.data ?? []}
          onChange={tagIds => set({ tagIds })}
          anyLabel={t.anyTag.value}
          selectedLabel={t.tagsSelected.value}
        />
      </div>
      <div className="seneca-all-tx__filters-toggles">
        {TOGGLES.map(toggle => (
          <FilterChipButton
            key={toggle}
            active={filters[toggle]}
            aria-pressed={filters[toggle]}
            onClick={() => set({ [toggle]: !filters[toggle] })}
          >
            {t[toggle]}
          </FilterChipButton>
        ))}
      </div>
      <div className="seneca-all-tx__filters-end">
        {hasFilters(filters) ? (
          <button
            type="button"
            className="seneca-all-tx__text-link"
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            {t.clearAll}
          </button>
        ) : null}
        <SavedViewsMenu filters={filters} onApply={onChange} />
      </div>
    </div>
  );
}
