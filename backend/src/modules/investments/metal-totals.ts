import type {
  Metal,
  MetalLot as MetalLotView,
  MetalSale as MetalSaleView,
  MetalTotals as MetalTotalsView,
} from '../../contracts';

const round2 = (value: number) => Math.round(value * 100) / 100;
const round8 = (value: number) => Math.round(value * 1e8) / 1e8;

/**
 * What the lots add up to, per metal and in all. A lot without a purchase
 * price counts in the value but not in the gain or the cost per ounce (#655):
 * counted at a zero cost, its whole value would show as profit. How many were
 * left out is said, so the page can say so.
 */
export function metalTotals(
  lots: MetalLotView[],
  sales: MetalSaleView[],
  discounts: Record<Metal, number>,
): {
  byMetal: MetalTotalsView[];
  value: number;
  cost: number;
  gain: number;
  unpricedLots: number;
} {
  const byMetal = new Map<Metal, MetalTotalsView & { pricedOunces: number; pricedValue: number }>();
  const totalsFor = (metal: Metal) => {
    const existing = byMetal.get(metal);
    if (existing) return existing;
    const created = {
      metal,
      fineOunces: 0,
      price: 0,
      pricedAt: null as string | null,
      value: 0,
      cost: 0,
      gain: 0,
      costPerOunce: null as number | null,
      unpricedLots: 0,
      dealerValue: 0,
      dealerDiscount: discounts[metal],
      realized: 0,
      pricedOunces: 0,
      pricedValue: 0,
    };
    byMetal.set(metal, created);
    return created;
  };

  for (const lot of lots) {
    const totals = totalsFor(lot.metal);
    totals.fineOunces = round8(totals.fineOunces + lot.fineOunces);
    totals.value = round2(totals.value + lot.value);
    totals.dealerValue = round2(totals.dealerValue + lot.dealerValue);
    if (lot.cost === null) {
      totals.unpricedLots += 1;
    } else {
      totals.cost = round2(totals.cost + lot.cost);
      totals.pricedOunces = round8(totals.pricedOunces + lot.fineOunces);
      totals.pricedValue = round2(totals.pricedValue + lot.value);
    }
    totals.gain = round2(totals.pricedValue - totals.cost);
    totals.price = lot.price;
    // The oldest quote wins: a total is only as fresh as its stalest lot.
    // ISO timestamps order the same way as the instants they name.
    if (lot.pricedAt && (!totals.pricedAt || lot.pricedAt < totals.pricedAt)) {
      totals.pricedAt = lot.pricedAt;
    }
  }
  for (const totals of byMetal.values()) {
    totals.costPerOunce =
      totals.pricedOunces > 0 && totals.cost > 0 ? round2(totals.cost / totals.pricedOunces) : null;
  }
  for (const sale of sales) {
    const totals = totalsFor(sale.metal);
    totals.realized = round2(totals.realized + (sale.realized ?? 0));
  }

  const priced = lots.filter(lot => lot.cost !== null);
  const cost = round2(priced.reduce((sum, lot) => sum + (lot.cost ?? 0), 0));
  return {
    byMetal: [...byMetal.values()]
      .map(({ pricedOunces: _ounces, pricedValue: _value, ...totals }) => totals)
      .sort((a, b) => b.value - a.value),
    value: round2(lots.reduce((sum, lot) => sum + lot.value, 0)),
    cost,
    gain: round2(priced.reduce((sum, lot) => sum + lot.value, 0) - cost),
    unpricedLots: lots.length - priced.length,
  };
}
