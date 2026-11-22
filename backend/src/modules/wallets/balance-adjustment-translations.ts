/**
 * The payee of a balance adjustment row, in the language of the person who
 * booked it: the row is theirs, as if they had typed it. Every locale the app
 * ships; anything else reads English.
 */
const BALANCE_ADJUSTMENT_PAYEE: Record<string, string> = {
  ru: 'Корректировка баланса',
  en: 'Balance adjustment',
  kk: 'Қалдықты түзету',
  de: 'Saldokorrektur',
  fr: 'Ajustement du solde',
  es: 'Ajuste de saldo',
  pt: 'Ajuste de saldo',
  tr: 'Bakiye düzeltmesi',
  uk: 'Коригування балансу',
  zh: '余额调整',
  pl: 'Korekta salda',
  it: 'Rettifica del saldo',
  sk: 'Úprava zostatku',
  ja: '残高調整',
  ko: '잔액 조정',
  hi: 'शेष राशि समायोजन',
  nl: 'Saldocorrectie',
  sv: 'Saldojustering',
  vi: 'Điều chỉnh số dư',
  id: 'Penyesuaian saldo',
  da: 'Saldoregulering',
  nb: 'Saldojustering',
  nn: 'Saldojustering',
  fi: 'Saldon oikaisu',
  is: 'Leiðrétting á stöðu',
  fo: 'Rætting av saldo',
  cs: 'Úprava zůstatku',
  bg: 'Корекция на салдото',
  hr: 'Usklađenje stanja',
  sr: 'Усклађивање стања',
  sl: 'Uskladitev stanja',
  mk: 'Корекција на салдото',
  be: 'Карэкціроўка балансу',
  bs: 'Usklađivanje stanja',
  hsb: 'Korektura salda',
};

export function balanceAdjustmentPayee(locale: string | null | undefined): string {
  const language = (locale ?? '').toLowerCase().split(/[-_]/)[0];
  return BALANCE_ADJUSTMENT_PAYEE[language] ?? BALANCE_ADJUSTMENT_PAYEE.en;
}
