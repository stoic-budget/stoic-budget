import type { PropertyLine } from '../../contracts';
import type { BalanceAccount } from '../../entities';
import { balanceAccountName } from '../balance/balance-account-name';
import type { LinkedWalletDebt } from '../balance/property/balance-property.service';
import { propertyKindOf } from '../balance/property/property-kind';
import { propertyEquity } from '../balance/property/property-math';
import type { CurrencyConverter } from '../exchange-rates/currency-converter';
import { round2 } from './net-worth-math';
import type { Valuation } from './net-worth-values';

/** The loan accounts the properties among `leaves` are linked to. */
export function linkedWalletIds(leaves: BalanceAccount[]): string[] {
  return [
    ...new Set(leaves.map(leaf => leaf.debtWalletId).filter((id): id is string => Boolean(id))),
  ];
}

/**
 * Each property and vehicle among `leaves` on `to`, with what is owed on it.
 * The figures are read with the same readers as the total, so a property's
 * value here is the one counted in net worth and its debt the one subtracted
 * from it; equity and LTV only put the two side by side.
 */
export function buildProperties(input: {
  accounts: BalanceAccount[];
  leaves: BalanceAccount[];
  valueAt: (accountId: string, code: string, date: string) => number;
  valuation: (accountId: string, date: string) => Valuation | null;
  walletDebts: Map<string, LinkedWalletDebt>;
  converter: CurrencyConverter;
  to: string;
  locale?: string;
}): PropertyLine[] {
  const { accounts, leaves, valueAt, valuation, walletDebts, converter, to, locale } = input;
  // A debt line taken off the page is not subtracted from net worth, so not from equity either.
  const byId = new Map(leaves.map(leaf => [leaf.id, leaf]));
  const lines: PropertyLine[] = [];

  for (const leaf of leaves) {
    const kind = propertyKindOf(leaf, accounts);
    if (!kind) continue;
    const value = round2(valueAt(leaf.id, leaf.code, to));
    const valued = valuation(leaf.id, to);
    const debt = debtOf(leaf, byId, walletDebts, valueAt, converter, to, locale);
    lines.push({
      accountId: leaf.id,
      name: balanceAccountName(leaf, locale),
      kind,
      value,
      estimated: valued?.estimated ?? false,
      valuedOn: valued?.valuedOn ?? null,
      depreciationRate: leaf.depreciationRate === null ? null : Number(leaf.depreciationRate),
      attributes: leaf.attributes as PropertyLine['attributes'],
      debt,
      ...propertyEquity(value, debt ? debt.amount : null),
    });
  }
  return lines.sort((a, b) => b.value - a.value);
}

function debtOf(
  leaf: BalanceAccount,
  byId: Map<string, BalanceAccount>,
  walletDebts: Map<string, LinkedWalletDebt>,
  valueAt: (accountId: string, code: string, date: string) => number,
  converter: CurrencyConverter,
  to: string,
  locale?: string,
): PropertyLine['debt'] {
  if (leaf.debtWalletId) {
    const wallet = walletDebts.get(leaf.debtWalletId);
    if (!wallet) return null;
    const owed = wallet.owed ? converter.convertAll(wallet.owed, to) : 0;
    return { kind: 'wallet', id: leaf.debtWalletId, name: wallet.name, amount: owe(owed) };
  }
  const line = leaf.debtAccountId ? byId.get(leaf.debtAccountId) : undefined;
  if (!line) return null;
  return {
    kind: 'liability',
    id: line.id,
    name: balanceAccountName(line, locale),
    amount: owe(valueAt(line.id, line.code, to)),
  };
}

const owe = (amount: number): number => Math.max(0, round2(amount));
