import { resolveLocaleTag } from '@/app/lib/user-format';

/** A count's sentence in three forms; languages with fewer repeat one. */
export interface PluralForms {
  one: string;
  few: string;
  many: string;
}

/** "{{count}} …" in the language's plural form; `two` (sl, hsb) reads like few. */
export function plural(locale: string, count: number, forms: PluralForms): string {
  const tag = resolveLocaleTag(locale);
  const category = new Intl.PluralRules(tag).select(count);
  const pattern =
    category === 'one'
      ? forms.one
      : category === 'few' || category === 'two'
        ? forms.few
        : forms.many;
  return pattern.replace('{{count}}', new Intl.NumberFormat(tag).format(count));
}
