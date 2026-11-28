export type CustomTableRowFilterOp =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'startsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'search';

export interface CustomTableRowFilterDto {
  col: string;
  op: CustomTableRowFilterOp;
  value?: unknown;
}

export type CustomTableRowSortDir = 'asc' | 'desc';

export interface CustomTableRowSortDto {
  col: string;
  dir: CustomTableRowSortDir;
}

export const CUSTOM_TABLE_AGGREGATE_FNS = ['sum', 'avg', 'min', 'max', 'count'] as const;

export type CustomTableAggregateFn = (typeof CUSTOM_TABLE_AGGREGATE_FNS)[number];

export interface CustomTableAggregateDto {
  col: string;
  fn: CustomTableAggregateFn;
}

export interface CustomTableAggregateResult {
  col: string;
  fn: CustomTableAggregateFn;
  value: number | string | null;
  /** The rows in scope are in several currencies: no one figure (#648). */
  mixedCurrencies?: boolean;
  /** The one currency the rows in scope share, for money a table keeps per row (#648). */
  currency?: string;
}
