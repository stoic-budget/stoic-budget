import { useMemo, useState } from 'react';
import {
  buildCurrencySearchIndex,
  type CurrencySearchItem,
  DEFAULT_RECENT_CURRENCIES,
} from '@/app/lib/statement-expense-drawer';

/** The currency drawer's search, recent picks and the list it shows, for the subscription form. */
export function useCurrencyPickerState(currency: string): {
  currencyDrawerOpen: boolean;
  setCurrencyDrawerOpen: (open: boolean) => void;
  currencySearch: string;
  setCurrencySearch: (value: string) => void;
  selectedCurrencyItem: CurrencySearchItem | undefined;
  selectedMatchesSearch: boolean;
  currencyQuery: string;
  recentCurrencyItems: CurrencySearchItem[];
  allCurrencyItems: CurrencySearchItem[];
  pushRecentCurrency: (code: string) => void;
} {
  const [currencyDrawerOpen, setCurrencyDrawerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>([
    ...DEFAULT_RECENT_CURRENCIES,
  ]);
  const currencyItems = useMemo(() => buildCurrencySearchIndex(), []);
  const currencyByCode = useMemo(
    () => new Map(currencyItems.map(item => [item.code, item])),
    [currencyItems],
  );
  const normalizedCurrency = currency.trim().toUpperCase();
  const selectedCurrencyItem = currencyByCode.get(normalizedCurrency);
  const currencyQuery = currencySearch.trim().toLowerCase();
  const selectedMatchesSearch = selectedCurrencyItem
    ? currencyQuery.length === 0 || selectedCurrencyItem.searchText.includes(currencyQuery)
    : false;
  const recentCurrencyItems = useMemo(
    () =>
      recentCurrencies
        .map(code => currencyByCode.get(code))
        .filter((item): item is CurrencySearchItem => Boolean(item))
        .filter(item => item.code !== normalizedCurrency),
    [currencyByCode, normalizedCurrency, recentCurrencies],
  );
  const allCurrencyItems = useMemo(() => {
    const source =
      currencyQuery.length > 0
        ? currencyItems.filter(item => item.searchText.includes(currencyQuery))
        : currencyItems;
    return source.filter(item => item.code !== normalizedCurrency);
  }, [currencyItems, currencyQuery, normalizedCurrency]);

  const pushRecentCurrency = (code: string): void => {
    setRecentCurrencies(prev => [code, ...prev.filter(item => item !== code)]);
    setCurrencySearch('');
    setCurrencyDrawerOpen(false);
  };

  return {
    currencyDrawerOpen,
    setCurrencyDrawerOpen,
    currencySearch,
    setCurrencySearch,
    selectedCurrencyItem,
    selectedMatchesSearch,
    currencyQuery,
    recentCurrencyItems,
    allCurrencyItems,
    pushRecentCurrency,
  };
}
