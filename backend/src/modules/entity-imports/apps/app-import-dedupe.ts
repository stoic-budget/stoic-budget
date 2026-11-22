import { createHash } from 'node:crypto';
import { type EntityManager, In } from 'typeorm';
import { generateTransactionFingerprint } from '../../../common/utils/fingerprint.util';
import { payeeKeyOf } from '../../../common/utils/payee-key.util';
import { Transaction } from '../../../entities/transaction.entity';
import type { PlannedAccount } from './app-plan-accounts';
import type { PlannedTxn } from './app-plan-transactions';

export interface FreshTxn extends PlannedTxn {
  fingerprint: string;
  currency: string;
  /** A row the workspace already has that becomes this transfer leg, instead of a new one. */
  adoptId: string | null;
}

/**
 * The row's fingerprint: its account, day, amount and direction, plus a hash
 * of its identity (the fingerprint keeps only 50 characters of the merchant,
 * which would cut the repeat count off a long payee).
 */
export function appFingerprint(
  workspaceId: string,
  txn: PlannedTxn,
  account: Pick<PlannedAccount, 'currency'>,
  ref: string,
): string {
  return generateTransactionFingerprint({
    workspaceId,
    accountNumber: `app:${ref}`,
    date: txn.date,
    amount: Math.abs(txn.amount),
    currency: account.currency,
    direction: txn.amount < 0 ? 'debit' : 'credit',
    merchant: `app:${createHash('sha256').update(txn.identity).digest('hex').slice(0, 40)}`,
  });
}

/**
 * The rows the workspace does not have yet. A transfer whose either leg is
 * there is left whole, and so is a split with any part already booked: half
 * of either would book the money twice or leave a part on its own.
 */
export async function freshTransactions(
  manager: EntityManager,
  workspaceId: string,
  txns: PlannedTxn[],
  accounts: Map<string, PlannedAccount>,
  ref: (accountKey: string) => string,
): Promise<{ fresh: FreshTxn[]; duplicates: number }> {
  const withPrints = txns.map(txn => {
    const account = accounts.get(txn.accountKey);
    const currency = account?.currency ?? '';
    return {
      ...txn,
      currency,
      adoptId: null,
      fingerprint: appFingerprint(workspaceId, txn, { currency }, ref(txn.accountKey)),
    };
  });
  const known = new Set<string>();
  const prints = [...new Set(withPrints.map(txn => txn.fingerprint))];
  for (let start = 0; start < prints.length; start += 1000) {
    const rows = await manager.getRepository(Transaction).find({
      select: { fingerprint: true },
      where: { workspaceId, fingerprint: In(prints.slice(start, start + 1000)) },
    });
    for (const row of rows) {
      if (row.fingerprint) {
        known.add(row.fingerprint);
      }
    }
  }
  const taken = new Set<string>();
  for (const txn of withPrints.filter(item => known.has(item.fingerprint))) {
    if (txn.pairKey) {
      taken.add(txn.pairKey);
    }
    if (txn.splitKey) {
      taken.add(txn.splitKey);
    }
  }
  const fresh = withPrints.filter(
    txn =>
      !known.has(txn.fingerprint) &&
      !(txn.pairKey && taken.has(txn.pairKey)) &&
      !(txn.splitKey && taken.has(txn.splitKey)),
  );
  return { fresh, duplicates: withPrints.length - fresh.length };
}

/** Payee keys of the rows, the way the payee subscriber will key them. */
export function payeeKeys(txns: FreshTxn[]): Set<string> {
  const keys = new Set<string>();
  for (const txn of txns) {
    const key = payeeKeyOf({ counterpartyName: txn.payee, paymentPurpose: txn.memo });
    if (key) {
      keys.add(key);
    }
  }
  return keys;
}

/** The keys among `keys` the workspace already knows a payee by. */
export async function knownPayeeKeys(
  manager: EntityManager,
  workspaceId: string,
  keys: Set<string>,
): Promise<Set<string>> {
  if (keys.size === 0) {
    return new Set();
  }
  const rows: Array<{ payee_key: string }> = await manager.query(
    'SELECT payee_key FROM payee_aliases WHERE workspace_id = $1 AND payee_key = ANY($2)',
    [workspaceId, [...keys]],
  );
  return new Set(rows.map(row => row.payee_key));
}
