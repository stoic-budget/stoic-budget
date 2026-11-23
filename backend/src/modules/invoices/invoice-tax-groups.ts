import type { TaxBreakdown } from '../tax/tax-calculation';

/** How a line is taxed: what decides the group it is rounded in. */
export interface LineTaxing {
  rate: number;
  isInclusive: boolean;
  isReverseCharge: boolean;
}

/**
 * Rounds the tax of each rate once, on the group's summed base, as EN 16931
 * does (BR-CO-17) and as the e-invoice writes it, then spreads the cent the
 * group rounding moved over its lines, so the lines add up to the group.
 * Rounding every line on its own made the books and the PDF a cent off the
 * XML: three lines of 10.00 including 19 % are 4.79 of tax, not 3 × 1.60.
 *
 * With net prices the nets stay and the tax moves; with tax-inclusive prices
 * the line totals the client was quoted stay and the net moves, to the net
 * whose rounded tax brings back the same total where one exists.
 */
export function roundByRateGroup<T extends TaxBreakdown>(lines: T[], taxing: LineTaxing[]): T[] {
  const result = lines.map(line => ({ ...line }));
  const groups = new Map<string, number[]>();
  lines.forEach((_, index) => {
    const tax = taxing[index];
    if (tax.isReverseCharge || tax.rate === 0) return;
    const key = `${tax.rate}:${tax.isInclusive}`;
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  for (const indexes of groups.values()) {
    const { rate, isInclusive } = taxing[indexes[0]];
    const sum = (field: 'netMinor' | 'grossMinor') =>
      indexes.reduce((total, index) => total + result[index][field], 0);
    if (isInclusive) {
      const gross = sum('grossMinor');
      const net = inclusiveNet(gross, rate);
      spread(result, indexes, 'netMinor', net - sum('netMinor'));
      const tax = Math.round((net * rate) / 100);
      // Where no net brings the total back, the total follows the tax.
      spread(result, indexes, 'grossMinor', net + tax - gross);
    } else {
      const tax = Math.round((sum('netMinor') * rate) / 100);
      spread(result, indexes, 'grossMinor', sum('netMinor') + tax - sum('grossMinor'));
    }
    for (const index of indexes) {
      result[index].taxMinor = result[index].grossMinor - result[index].netMinor;
      result[index].notionalTaxMinor = result[index].taxMinor;
    }
  }
  return result;
}

/** The net whose tax, rounded once, adds back up to `gross`; the nearest one if none does. */
function inclusiveNet(gross: number, rate: number): number {
  const guess = Math.round((gross * 100) / (100 + rate));
  for (const step of [0, -1, 1, -2, 2]) {
    const net = guess + step;
    if (net + Math.round((net * rate) / 100) === gross) return net;
  }
  return guess;
}

/** Moves `cents` across the group's lines, one at a time, largest lines first. */
function spread(
  lines: TaxBreakdown[],
  indexes: number[],
  field: 'netMinor' | 'grossMinor',
  cents: number,
): void {
  if (cents === 0) return;
  const order = [...indexes].sort((a, b) => Math.abs(lines[b][field]) - Math.abs(lines[a][field]));
  const step = Math.sign(cents);
  for (let left = Math.abs(cents), at = 0; left > 0; left -= 1, at += 1) {
    lines[order[at % order.length]][field] += step;
  }
}
