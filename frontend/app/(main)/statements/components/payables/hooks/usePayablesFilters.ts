'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_PAYABLES_FILTERS,
  filtersFromSearchParams,
  type PayablesFiltersState,
} from '../payables-utils';

/** Filters and page of the list; a status or source in the address sets them. */
export function usePayablesFilters() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<PayablesFiltersState>(DEFAULT_PAYABLES_FILTERS);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const nextFilters = filtersFromSearchParams(searchParams);

    setFilters(current => {
      if (
        current.search === nextFilters.search &&
        current.status === nextFilters.status &&
        current.source === nextFilters.source &&
        current.dueDateFrom === nextFilters.dueDateFrom &&
        current.dueDateTo === nextFilters.dueDateTo &&
        current.tagId === nextFilters.tagId &&
        current.sort === nextFilters.sort
      ) {
        return current;
      }

      return nextFilters;
    });
    setPage(1);
  }, [searchParams]);

  const handleFiltersChange = useCallback((next: PayablesFiltersState) => {
    setFilters(next);
    setPage(1);
  }, []);

  return { filters, page, setPage, handleFiltersChange };
}
