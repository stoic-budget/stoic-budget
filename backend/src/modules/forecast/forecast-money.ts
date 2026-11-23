/** A currency code, or the app's fallback when the value is not one. */
export function normalizeCurrency(currency: string | null | undefined): string {
  const normalized = String(currency || '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'KZT';
}

/** Cents. */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}
