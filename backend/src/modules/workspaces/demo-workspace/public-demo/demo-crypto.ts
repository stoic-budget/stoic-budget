import { Logger } from '@nestjs/common';
import type { CryptoImportService } from '../../../crypto/crypto-import.service';
import type { CryptoPriceService } from '../../../crypto/crypto-price.service';
import { addDays } from '../demo-dates';

export interface DemoCryptoDeps {
  cryptoImport: CryptoImportService;
  cryptoPrice: CryptoPriceService;
}

/** Used when the price source does not answer: low enough to stay below any recent price. */
const FALLBACK_USD: Record<string, number> = { BTC: 30_000, ETH: 1_500 };

/**
 * Buys over the year, as share of today's price: the holdings page values
 * them at the live price, so a buy priced above it would show a loss on the
 * front page of the demo.
 */
const ROWS: Array<{
  asset: 'BTC' | 'ETH';
  days: number;
  quantity: number;
  share: number;
  kind: 'Buy' | 'Staking Income';
}> = [
  { asset: 'BTC', days: 330, quantity: 0.02, share: 0.55, kind: 'Buy' },
  { asset: 'ETH', days: 300, quantity: 0.6, share: 0.58, kind: 'Buy' },
  { asset: 'BTC', days: 240, quantity: 0.015, share: 0.6, kind: 'Buy' },
  { asset: 'BTC', days: 150, quantity: 0.01, share: 0.68, kind: 'Buy' },
  { asset: 'ETH', days: 120, quantity: 0.4, share: 0.7, kind: 'Buy' },
  { asset: 'BTC', days: 60, quantity: 0.012, share: 0.78, kind: 'Buy' },
  { asset: 'ETH', days: 30, quantity: 0.004, share: 0.8, kind: 'Staking Income' },
];

/** A small Coinbase account, imported the way a person would: its CSV export. */
export async function seedDemoCrypto(
  deps: DemoCryptoDeps,
  ids: { workspaceId: string; userId: string },
  anchor: string,
): Promise<void> {
  const live = await deps.cryptoPrice.getCurrentUsdPrices(['BTC', 'ETH']).catch(() => ({}));
  const usd = (asset: string): number =>
    (live as Record<string, number>)[asset] ?? FALLBACK_USD[asset];
  const result = await deps.cryptoImport.importCsv(
    ids.workspaceId,
    ids.userId,
    coinbaseCsv(anchor, usd),
  );
  new Logger('DemoCrypto').log(`Imported ${result.imported} crypto rows`);
}

function coinbaseCsv(anchor: string, usd: (asset: string) => number): string {
  const header =
    'ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes';
  const rows = ROWS.map((row, index) => {
    const price = Math.round(usd(row.asset) * row.share);
    const subtotal = (price * row.quantity).toFixed(2);
    const fee = row.kind === 'Buy' ? (Number(subtotal) * 0.01).toFixed(2) : '0.00';
    const total = (Number(subtotal) + Number(fee)).toFixed(2);
    const note = row.kind === 'Buy' ? `Bought ${row.quantity} ${row.asset} for €${total} EUR` : '';
    return [
      `demo-${index + 1}`,
      `${addDays(anchor, -row.days)}T10:00:00Z`,
      row.kind,
      row.asset,
      row.quantity,
      'EUR',
      price,
      subtotal,
      total,
      fee,
      note,
    ].join(',');
  });
  return [
    'You can use this transaction report to inform your likely tax obligations.',
    '',
    header,
    ...rows,
  ].join('\n');
}
