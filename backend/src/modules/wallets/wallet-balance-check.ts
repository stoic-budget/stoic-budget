import type { WalletItem, WalletReconciliation } from '../../contracts';
import type { Statement } from '../../entities/statement.entity';
import type { Wallet } from '../../entities/wallet.entity';
import { balanceAtEndOf, CENT, round2 } from './balance-check-reasons';
import { toDateOnly, type WalletLedger } from './wallet-ledger';

/** A closing balance within a cent of the booked one is the same balance. */
const RECONCILE_TOLERANCE = 0.01;

/** The last matching check, and whether a row edited or removed since has undone it. */
export function balanceCheckOf(
  wallet: Wallet,
  days: WalletLedger['days'],
): WalletItem['balanceCheck'] {
  const date = toDateOnly(wallet.balanceCheckedAt);
  if (!date || wallet.balanceCheckedAmount === null) {
    return null;
  }
  const bankBalance = round2(Number(wallet.balanceCheckedAmount));
  const ours = balanceAtEndOf(Number(wallet.initialBalance) || 0, days, date);
  return { date, bankBalance, stillMatches: Math.abs(ours - bankBalance) < CENT };
}

/** Each account's latest statement with a closing balance, against the balance booked up to its last day. */
export function reconciliationsFrom(
  latest: Statement[],
  wallets: Wallet[],
  ledgers: Map<string, WalletLedger>,
): Map<string, WalletReconciliation> {
  const byId = new Map(wallets.map(wallet => [wallet.id, wallet]));
  const result = new Map<string, WalletReconciliation>();
  for (const statement of latest) {
    const wallet = statement.walletId ? byId.get(statement.walletId) : undefined;
    const date = toDateOnly(statement.statementDateTo);
    if (!(wallet && date)) {
      continue;
    }
    const booked = (ledgers.get(wallet.id)?.days ?? [])
      .filter(day => day.date <= date)
      .reduce((sum, day) => sum + day.net, 0);
    const computedBalance = round2((Number(wallet.initialBalance) || 0) + booked);
    const statementBalance = round2(Number(statement.balanceEnd));
    result.set(wallet.id, {
      statementId: statement.id,
      date,
      statementBalance,
      computedBalance,
      matches: Math.abs(computedBalance - statementBalance) <= RECONCILE_TOLERANCE,
    });
  }
  return result;
}
