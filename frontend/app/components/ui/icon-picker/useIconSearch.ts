'use client';

import { useEffect, useMemo, useState } from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import { LABEL_KEY_BY_NAME } from '@/app/lib/category-icon-choices';
import { GROUP_TERM_LOADERS } from '@/app/lib/icons/group-terms';
import type { GroupTerms } from '@/app/lib/icons/group-terms/types';
import { useIconCatalog } from '@/app/lib/icons/icon-catalog';
import { groupIcons, ICON_GROUP_KEYS } from '@/app/lib/icons/icon-groups';
import { groupTerms, listingOrder, searchIcons } from '@/app/lib/icons/icon-search';
import { humanIconName } from '@/app/lib/icons/icon-value';
import { type AppLocale, isSupportedLocale } from '@/app/lib/locale';

/** English and the user's language: an English word always finds its icons. */
function useGroupTerms(locale: AppLocale, enabled: boolean): GroupTerms[] {
  const [loaded, setLoaded] = useState<{ locale: AppLocale; terms: GroupTerms[] } | null>(null);
  useEffect(() => {
    if (!enabled || loaded?.locale === locale) {
      return;
    }
    let live = true;
    const wanted = locale === 'en' ? ['en' as const] : (['en', locale] as const);
    Promise.all(wanted.map(code => GROUP_TERM_LOADERS[code]())).then(
      modules => {
        if (live) {
          setLoaded({ locale, terms: modules.map(module => module.default) });
        }
      },
      (error: unknown) => console.error('Icon group words failed to load:', error),
    );
    return () => {
      live = false;
    };
  }, [enabled, locale, loaded?.locale]);
  return loaded?.locale === locale ? loaded.terms : [];
}

/**
 * Everything the icon picker shows: the catalogue, loaded when the picker
 * first opens, searched with what the user typed, and each icon's name in
 * the user's language where the app has one.
 */
export function useIconSearch(open: boolean, query: string) {
  const { locale: rawLocale } = useLocale();
  const locale: AppLocale = isSupportedLocale(rawLocale) ? rawLocale : 'en';
  const iconNames = useIntlayer('categoryIcons');
  const { catalog, failed } = useIconCatalog(open);
  const termSets = useGroupTerms(locale, open);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const [name, key] of LABEL_KEY_BY_NAME) {
      map.set(name, iconNames[key].value);
    }
    return map;
  }, [iconNames]);

  const index = useMemo(() => {
    if (!catalog) {
      return null;
    }
    const groups = ICON_GROUP_KEYS.map(key => ({
      icons: groupIcons(key),
      terms: termSets.flatMap(terms => groupTerms(terms[key], locale)),
    }));
    return {
      order: listingOrder(catalog.names, groups),
      words: catalog.words,
      labels: new Map([...labels].map(([name, label]) => [name, label.toLocaleLowerCase(locale)])),
      groups,
    };
  }, [catalog, termSets, labels, locale]);

  const results = useMemo(
    () => (index ? searchIcons(index, query, locale) : []),
    [index, query, locale],
  );

  const labelOf = (name: string) => labels.get(name) ?? humanIconName(name);
  return { results, loading: !(catalog || failed), failed, labelOf };
}
