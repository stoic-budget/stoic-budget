'use client';

import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { Select } from '@/app/components/ui/select';

import { formatCellNumber } from '../utils/numberFormat';
import { AGGREGATE_FNS, type AggregateFn, type CustomTableColumn } from '../utils/types';

import { numberFormatFor } from './cells/formatCell';

import type { TableGridProps } from './TableGrid';

export function AggregateFooter({
  column,
  fallbackCurrency,
  aggregates,
  aggregateValues,
  onAggregateChange,
  labels,
}: Pick<
  TableGridProps,
  'aggregates' | 'aggregateValues' | 'onAggregateChange' | 'fallbackCurrency' | 'labels'
> & {
  column: CustomTableColumn;
}) {
  const fn = aggregates[column.key] ?? '';
  const raw = aggregateValues[column.key];
  const format = numberFormatFor(column, fallbackCurrency);
  const value =
    typeof raw === 'number' ? formatCellNumber(raw, fn === 'count' ? {} : format) : (raw ?? '');
  return (
    <span className={`seneca-ct__footer${fn ? '' : ' seneca-ct__footer--unset'}`}>
      <Select
        size="small"
        variant="standard"
        disableUnderline
        className="seneca-ct__footer-select"
        inputProps={{ 'aria-label': `${labels.noTotal}: ${column.title}` }}
        value={fn}
        onChange={next => onAggregateChange(column.key, (next || null) as AggregateFn | null)}
        options={[
          { value: '', label: labels.noTotal },
          ...AGGREGATE_FNS.map(item => ({ value: item, label: labels.aggregates[item] })),
        ]}
      />
      {fn ? (
        <span
          className={`seneca-ct__footer-value${
            column.type === 'currency' && fn !== 'count' && typeof raw === 'number'
              ? ` ${PRIVATE_CLASS}`
              : ''
          }`}
        >
          {value}
        </span>
      ) : null}
    </span>
  );
}
