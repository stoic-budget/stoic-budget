'use client';

import { useQuery } from '@tanstack/react-query';

import CustomDatePicker from '@/app/components/CustomDatePicker';

import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useLocale } from '@/app/i18n';

import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { resolveLocaleTag } from '@/app/lib/user-format';

import type { TableCategory } from '../hooks/useTablesList';
import { DIRECTION_OPTIONS, type SourceDef, type SourceFilters, TYPE_OPTIONS } from '../sources';
import { FilterDrawerField, type FilterDrawerLabels } from './FilterDrawerField';
import { CategoriesFilterField, CurrencyFilterField } from './filter-picker-fields';
import type { SourceFilterPanelLabels } from './source-filter-labels';
import { statementFilterOptions } from './statement-filter-options';

const STATEMENTS_LIMIT = 50;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="seneca-ct__field">
      <span className="seneca-ct__label">{label}</span>
      {children}
    </div>
  );
}

function OptionSelect({
  label,
  value,
  values,
  drawerLabels,
  optionLabels,
  onChange,
}: {
  label: string;
  value: string;
  values: readonly string[];
  drawerLabels: FilterDrawerLabels;
  optionLabels: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <FilterDrawerField
        label={label}
        options={values.map(item => ({ value: item, label: optionLabels[item] ?? item }))}
        value={value ? [value] : []}
        onChange={next => onChange(next[0] ?? '')}
        labels={drawerLabels}
      />
    </Field>
  );
}

interface SourceFilterFieldsProps {
  source: SourceDef;
  filters: SourceFilters;
  onChange: (patch: Partial<SourceFilters>) => void;
  categories: TableCategory[];
  labels: SourceFilterPanelLabels;
}

/** The chosen source's filters, as plain fields of one look. */
export function SourceFilterFields(props: SourceFilterFieldsProps) {
  const { source, filters, onChange, categories, labels } = props;
  const workspaceId = useWorkspaceId();
  const { locale } = useLocale();
  const { any, selected, search, noMatches } = labels.filters;
  const drawerLabels: FilterDrawerLabels = { any, selected, search, noMatches };
  const wantsStatements = source.filterFields.includes('statements');
  const statementsQuery = useQuery({
    queryKey: [...queryKeys.customTables(workspaceId), 'source-statements'],
    queryFn: async ({ signal }) =>
      apiQueryDecoded({
        url: '/statements',
        params: { page: 1, limit: STATEMENTS_LIMIT } satisfies ContractInput<'StatementsQuery'>,
        signal,
        contract: 'StatementList',
      }),
    enabled: wantsStatements && Boolean(workspaceId),
  });
  const has = (field: SourceDef['filterFields'][number]) => source.filterFields.includes(field);
  if (!source.filterFields.length) {
    return null;
  }

  return (
    <section className="seneca-ct__source-section">
      <div className="seneca-ct__section-head">
        <h3 className="seneca-ct__section-title">{labels.filters.title}</h3>
        {has('dateRange') && (filters.dateFrom || filters.dateTo) ? (
          <button
            type="button"
            className="seneca-ct__text-button"
            onClick={() => onChange({ dateFrom: '', dateTo: '' })}
          >
            {labels.preview.allTime}
          </button>
        ) : null}
      </div>
      <div className="seneca-ct__source-filters">
        {has('dateRange') ? (
          <>
            <Field label={labels.filters.dateFrom}>
              <CustomDatePicker
                compact
                value={filters.dateFrom}
                onChange={dateFrom => onChange({ dateFrom })}
                maxDate={filters.dateTo || undefined}
              />
            </Field>
            <Field label={labels.filters.dateTo}>
              <CustomDatePicker
                compact
                value={filters.dateTo}
                onChange={dateTo => onChange({ dateTo })}
                minDate={filters.dateFrom || undefined}
              />
            </Field>
          </>
        ) : null}
        {has('dueRange') ? (
          <>
            <Field label={labels.filters.dueFrom}>
              <CustomDatePicker
                compact
                value={filters.dueDateFrom}
                onChange={dueDateFrom => onChange({ dueDateFrom })}
                maxDate={filters.dueDateTo || undefined}
              />
            </Field>
            <Field label={labels.filters.dueTo}>
              <CustomDatePicker
                compact
                value={filters.dueDateTo}
                onChange={dueDateTo => onChange({ dueDateTo })}
                minDate={filters.dueDateFrom || undefined}
              />
            </Field>
          </>
        ) : null}
        {has('type') ? (
          <OptionSelect
            label={labels.filters.type}
            value={filters.type}
            values={TYPE_OPTIONS}
            drawerLabels={drawerLabels}
            optionLabels={labels.options}
            onChange={type => onChange({ type })}
          />
        ) : null}
        {has('direction') ? (
          <OptionSelect
            label={labels.filters.direction}
            value={filters.direction}
            values={DIRECTION_OPTIONS}
            drawerLabels={drawerLabels}
            optionLabels={labels.options}
            onChange={direction => onChange({ direction })}
          />
        ) : null}
        {has('status') && source.statusOptions ? (
          <OptionSelect
            label={labels.filters.status}
            value={filters.status}
            values={source.statusOptions}
            drawerLabels={drawerLabels}
            optionLabels={labels.options}
            onChange={status => onChange({ status })}
          />
        ) : null}
        {has('currency') ? (
          <Field label={labels.filters.currency}>
            <CurrencyFilterField
              label={labels.filters.currency}
              value={filters.currency}
              anyLabel={labels.filters.any}
              onChange={currency => onChange({ currency })}
            />
          </Field>
        ) : null}
        {has('categories') ? (
          <Field label={labels.filters.categories}>
            <CategoriesFilterField
              label={labels.filters.categories}
              value={filters.categoryIds}
              categories={categories}
              anyLabel={labels.filters.any}
              emptyLabel={labels.filters.categoriesEmpty}
              selectedLabel={labels.filters.selected}
              onChange={categoryIds => onChange({ categoryIds })}
            />
          </Field>
        ) : null}
        {wantsStatements ? (
          <Field label={labels.filters.statements}>
            <FilterDrawerField
              label={labels.filters.statements}
              multiple
              value={filters.statementIds}
              options={statementFilterOptions(statementsQuery.data ?? [], resolveLocaleTag(locale))}
              emptyLabel={statementsQuery.data ? labels.filters.statementsEmpty : undefined}
              labels={drawerLabels}
              onChange={statementIds => onChange({ statementIds })}
            />
          </Field>
        ) : null}
      </div>
    </section>
  );
}
