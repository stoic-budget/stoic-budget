import { vatBreakdownOf } from '@/modules/e-invoices/xrechnung-writer';
import { roundByRateGroup } from '@/modules/invoices/invoice-tax-groups';
import { computeTax } from '@/modules/tax/tax-calculation';

const line = (amountMinor: number, rate: number, isInclusive: boolean) => ({
  rate,
  isInclusive,
  isReverseCharge: false,
  breakdown: computeTax({ amountMinor, rate, isInclusive }),
});

function price(lines: ReturnType<typeof line>[]) {
  const priced = roundByRateGroup(
    lines.map(l => l.breakdown),
    lines.map(({ rate, isInclusive, isReverseCharge }) => ({ rate, isInclusive, isReverseCharge })),
  );
  const sum = (field: 'netMinor' | 'taxMinor' | 'grossMinor') =>
    priced.reduce((total, l) => total + l[field], 0);
  // What the e-invoice writes for the same lines: tax rounded once on the base.
  const xml = vatBreakdownOf(
    priced.map((l, i) => ({ category: 'S', rate: lines[i].rate, net: l.netMinor / 100 }) as never),
  );
  const xmlTax = xml.reduce((total, g) => total + g.taxCents, 0);
  return { priced, net: sum('netMinor'), tax: sum('taxMinor'), gross: sum('grossMinor'), xmlTax };
}

describe('roundByRateGroup', () => {
  it('keeps the quoted total of tax-inclusive prices and matches the e-invoice', () => {
    // 3 × 10.00 including 19 %: 4.79 of tax on 25.21, not 3 × 1.60.
    const { net, tax, gross, xmlTax } = price([line(1000, 19, true), line(1000, 19, true), line(1000, 19, true)]);

    expect({ net, tax, gross }).toEqual({ net: 2521, tax: 479, gross: 3000 });
    expect(xmlTax).toBe(tax);
  });

  it('rounds the tax of net prices once, as the e-invoice does', () => {
    // 3 × 12.35 net at 19 %: 7.04 of tax, 44.09 in all, not 44.10.
    const { net, tax, gross, xmlTax } = price([line(1235, 19, false), line(1235, 19, false), line(1235, 19, false)]);

    expect({ net, tax, gross }).toEqual({ net: 3705, tax: 704, gross: 4409 });
    expect(xmlTax).toBe(tax);
  });

  it('rounds each rate on its own and leaves untaxed lines alone', () => {
    const { priced } = price([line(1235, 19, false), line(1000, 7, false), line(500, 0, false)]);

    expect(priced.map(l => l.taxMinor)).toEqual([235, 70, 0]);
  });

  it('keeps every line consistent: net plus tax is its gross', () => {
    const { priced } = price([line(1000, 19, true), line(333, 19, true), line(1, 19, true)]);

    for (const l of priced) expect(l.netMinor + l.taxMinor).toBe(l.grossMinor);
  });
});
