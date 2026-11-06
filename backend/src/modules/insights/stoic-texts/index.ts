import { be } from './be-translations';
import { bg } from './bg-translations';
import { bs } from './bs-translations';
import { cs } from './cs-translations';
import { da } from './da-translations';
import { de } from './de-translations';
import { en } from './en-translations';
import { es } from './es-translations';
import { fi } from './fi-translations';
import { fo } from './fo-translations';
import { fr } from './fr-translations';
import { hi } from './hi-translations';
import { hr } from './hr-translations';
import { hsb } from './hsb-translations';
import { id } from './id-translations';
import { is } from './is-translations';
import { it } from './it-translations';
import { ja } from './ja-translations';
import { kk } from './kk-translations';
import { ko } from './ko-translations';
import { mk } from './mk-translations';
import { nb } from './nb-translations';
import { nl } from './nl-translations';
import { nn } from './nn-translations';
import { pl } from './pl-translations';
import { pt } from './pt-translations';
import { ru } from './ru-translations';
import { sk } from './sk-translations';
import { sl } from './sl-translations';
import { sr } from './sr-translations';
import { sv } from './sv-translations';
import { tr } from './tr-translations';
import type { StoicMessageKey, StoicTextMap } from './types';
import { uk } from './uk-translations';
import { vi } from './vi-translations';
import { zh } from './zh-translations';

export const STOIC_TEXTS: Record<string, StoicTextMap> = {
  ru,
  en,
  kk,
  de,
  fr,
  es,
  pt,
  tr,
  uk,
  zh,
  pl,
  it,
  sk,
  ja,
  ko,
  hi,
  nl,
  sv,
  vi,
  id,
  da,
  nb,
  nn,
  fi,
  is,
  fo,
  cs,
  bg,
  hr,
  sr,
  sl,
  mk,
  be,
  bs,
  hsb,
};

export function isStoicKey(key: string): key is StoicMessageKey {
  return key in en;
}
