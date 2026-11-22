import { parseAmount } from '@/app/(main)/roi/roi-model';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { type FilterPaymentType, paymentTypeFromParams } from './all-transactions';

/** What the table is narrowed by, besides the period. Mirrored in the URL. */
export interface TransactionFilters {
  q?: string;
  amountMin?: number;
  amountMax?: number;
  categoryIds: string[];
  tagIds: string[];
  uncategorized: boolean;
  untagged: boolean;
  noPayee: boolean;
  paymentType?: FilterPaymentType;
}

export const EMPTY_FILTERS: TransactionFilters = {
  categoryIds: [],
  tagIds: [],
  uncategorized: false,
  untagged: false,
  noPayee: false,
};

/** The URL keys the filters own; the period (`month`, `all`) is not one of them. */
const FILTER_KEYS = [
  'q',
  'amountMin',
  'amountMax',
  'categoryIds',
  'tagIds',
  'uncategorized',
  'untagged',
  'noPayee',
  'paymentType',
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idsOf(value: string | null): string[] {
  return [...new Set((value ?? '').split(',').map(item => item.trim()))].filter(id =>
    UUID.test(id),
  );
}

/**
 * A bound the API accepts (a number, zero or more), else none. Typed as people
 * type amounts: "1,000", "1 000", "1.000,50" and "12,5" all read as meant.
 */
export function amountOf(value: string | null | undefined): number | undefined {
  if (value == null) {
    return undefined;
  }
  const amount = parseAmount(value);
  return amount !== null && amount >= 0 ? amount : undefined;
}

/** The filters a link carries; anything malformed is left out rather than sent. */
export function filtersFromParams(params: {
  get(name: string): string | null;
}): TransactionFilters {
  const q = params.get('q')?.trim().slice(0, 200);
  const paymentType = paymentTypeFromParams(params);
  return {
    ...(q ? { q } : {}),
    ...withDefined('amountMin', amountOf(params.get('amountMin'))),
    ...withDefined('amountMax', amountOf(params.get('amountMax'))),
    categoryIds: idsOf(params.get('categoryIds')),
    tagIds: idsOf(params.get('tagIds')),
    uncategorized: params.get('uncategorized') === '1',
    untagged: params.get('untagged') === '1',
    noPayee: params.get('noPayee') === '1',
    ...(paymentType ? { paymentType } : {}),
  };
}

function withDefined<K extends string>(key: K, value: number | undefined) {
  return value === undefined ? {} : ({ [key]: value } as Record<K, number>);
}

/** `current` with the filter keys replaced by `filters`; other keys (the period) stay. */
export function withFilters(
  current: URLSearchParams,
  filters: TransactionFilters,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  for (const key of FILTER_KEYS) {
    params.delete(key);
  }
  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.amountMin !== undefined) {
    params.set('amountMin', String(filters.amountMin));
  }
  if (filters.amountMax !== undefined) {
    params.set('amountMax', String(filters.amountMax));
  }
  if (filters.categoryIds.length) {
    params.set('categoryIds', filters.categoryIds.join(','));
  }
  if (filters.tagIds.length) {
    params.set('tagIds', filters.tagIds.join(','));
  }
  for (const toggle of ['uncategorized', 'untagged', 'noPayee'] as const) {
    if (filters[toggle]) {
      params.set(toggle, '1');
    }
  }
  if (filters.paymentType) {
    params.set('paymentType', filters.paymentType);
  }
  return params;
}

/** One string per filter set: the page and the ticked rows start afresh when it changes. */
export function filtersKey(filters: TransactionFilters): string {
  return withFilters(new URLSearchParams(), filters).toString();
}

export function hasFilters(filters: TransactionFilters): boolean {
  return filtersKey(filters) !== '';
}

/** The filters as `GET /transactions` takes them: lists comma-joined, toggles only when on. */
export function filtersToQuery(filters: TransactionFilters) {
  return {
    q: filters.q || undefined,
    amountMin: filters.amountMin,
    amountMax: filters.amountMax,
    categoryIds: filters.categoryIds.length ? filters.categoryIds.join(',') : undefined,
    tagIds: filters.tagIds.length ? filters.tagIds.join(',') : undefined,
    uncategorized: filters.uncategorized || undefined,
    untagged: filters.untagged || undefined,
    noPayee: filters.noPayee || undefined,
    paymentType: filters.paymentType,
  } satisfies ContractInput<'TransactionListQuery'>;
}
