export interface SourceFilterPanelLabels {
  filters: Record<
    | 'title'
    | 'dateFrom'
    | 'dateTo'
    | 'categories'
    | 'categoriesEmpty'
    | 'type'
    | 'currency'
    | 'currencyPlaceholder'
    | 'statements'
    | 'statementsEmpty'
    | 'status'
    | 'direction'
    | 'dueFrom'
    | 'dueTo'
    | 'any'
    | 'selected'
    | 'search'
    | 'noMatches',
    string
  >;
  /** Translated enum values: income, expense, payable, to_pay, draft… */
  options: Record<string, string>;
  preview: Record<
    | 'title'
    | 'count'
    | 'countOf'
    | 'sample'
    | 'loading'
    | 'empty'
    | 'overwriteNote'
    | 'failed'
    | 'resetFilters'
    | 'sourceLine'
    | 'allTime'
    | 'existing'
    | 'openExisting',
    string
  >;
}
