import { nameKey } from '../helpers/import-values';
import type { AppTxn } from './app-model';
import { transferKeyOf } from './app-plan-accounts';
import { categoryKey } from './app-plan-categories';

export interface PlannedTxn {
  accountKey: string;
  date: string;
  /** Signed, in the account's currency. */
  amount: number;
  payee: string;
  memo: string;
  categoryKey: string | null;
  splitKey: string | null;
  /** The two legs of one transfer share it. */
  pairKey: string | null;
  /** What tells this row from every other one of its account, a re-import included. */
  identity: string;
  /** The leg of a transfer whose other side the files did not have. */
  synthetic: boolean;
  /**
   * The identity the row had when it was read as an ordinary row: an Actual
   * leg whose payee names an account the workspace did not know back then.
   */
  former: string | null;
}

export interface TxnPlan {
  txns: PlannedTxn[];
  transfers: number;
}

type Leg = { txn: AppTxn; own: string; other: string; former: string | null };

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The rows as they will be booked. A transfer becomes one pair of legs: both
 * from the files when both sides are there (YNAB and Actual list each side in
 * its own account), one row's two sides (Firefly), or the side the files had
 * plus the other side written for it. Identities count repeats, so two equal
 * coffees on one day stay two rows and the same file read twice matches itself.
 * `ref` names an account the way fingerprints must: its workspace id.
 */
export function planTransactions(
  txns: AppTxn[],
  known: Set<string>,
  names: Map<string, string>,
  ref: (accountKey: string) => string,
): TxnPlan {
  const planned: PlannedTxn[] = [];
  const seen = new Map<string, number>();
  const occurrence = (key: string) => {
    const next = (seen.get(key) ?? 0) + 1;
    seen.set(key, next);
    return next;
  };
  const outs = new Map<string, Leg[]>();
  const ins = new Map<string, Leg[]>();
  let transfers = 0;
  // A leg is paid to or received from the other account, whatever the app wrote ("Transfer : X").
  const nameOf = (accountKey: string) => names.get(accountKey) ?? accountKey;

  const addPair = (
    out: Omit<PlannedTxn, 'identity' | 'pairKey' | 'categoryKey'>,
    into: typeof out,
  ) => {
    const [from, to] = [ref(out.accountKey), ref(into.accountKey)];
    const k = occurrence(`pair|${out.date}|${from}|${to}|${Math.abs(out.amount)}`);
    const pairKey = `pair-${transfers}`;
    transfers += 1;
    planned.push(
      { ...out, categoryKey: null, pairKey, identity: `transfer-out|${to}|${k}` },
      { ...into, categoryKey: null, pairKey, identity: `transfer-in|${from}|${k}` },
    );
  };
  const legOf = (
    txn: AppTxn,
    account: string,
    amount: number,
    payee: string,
    synthetic: boolean,
    former: string | null = null,
  ) => ({
    accountKey: account,
    date: txn.date,
    amount,
    payee,
    memo: txn.memo,
    splitKey: synthetic ? null : txn.splitKey,
    synthetic,
    former: synthetic ? null : former,
  });

  for (const txn of txns.filter(item => !item.opening)) {
    const own = nameKey(txn.account);
    const other = transferKeyOf(txn, known);
    const base = `row|${ref(own)}|${txn.date}|${txn.amount}|${txn.payee}|${txn.memo}`;
    if (!other) {
      planned.push({
        ...legOf(txn, own, txn.amount, txn.payee, false),
        categoryKey: txn.category ? categoryKey(txn.group, txn.category) : null,
        pairKey: null,
        identity: `${base}|${occurrence(base)}`,
      });
      continue;
    }
    // Read before the payee's account was known, this row was booked as an ordinary one.
    const former = txn.payeeMayBeAccount && !txn.transferTo ? `${base}|${occurrence(base)}` : null;
    if (txn.arrived) {
      addPair(
        legOf(txn, own, -Math.abs(txn.amount), nameOf(other), false),
        legOf(txn, other, Math.abs(txn.arrived.amount), nameOf(own), false),
      );
      continue;
    }
    const outgoing = txn.amount < 0;
    const key = `${txn.date}|${Math.abs(txn.amount)}|${outgoing ? own : other}|${outgoing ? other : own}`;
    const bucket = outgoing ? outs : ins;
    bucket.set(key, [...(bucket.get(key) ?? []), { txn, own, other, former }]);
  }

  for (const key of new Set([...outs.keys(), ...ins.keys()])) {
    const [sent, received] = [outs.get(key) ?? [], ins.get(key) ?? []];
    for (let index = 0; index < Math.max(sent.length, received.length); index += 1) {
      const [out, into] = [sent[index], received[index]];
      const size = round(Math.abs((out ?? into).txn.amount));
      addPair(
        out
          ? legOf(out.txn, out.own, -size, nameOf(out.other), false, out.former)
          : legOf(into.txn, into.other, -size, nameOf(into.own), true),
        into
          ? legOf(into.txn, into.own, size, nameOf(into.other), false, into.former)
          : legOf(out.txn, out.other, size, nameOf(out.own), true),
      );
    }
  }
  return { txns: dropLoneSplits(planned), transfers };
}

/** A split whose other parts did not make it is an ordinary row. */
function dropLoneSplits(txns: PlannedTxn[]): PlannedTxn[] {
  const sizes = new Map<string, number>();
  for (const txn of txns) {
    if (txn.splitKey) {
      sizes.set(txn.splitKey, (sizes.get(txn.splitKey) ?? 0) + 1);
    }
  }
  return txns.map(txn =>
    txn.splitKey && (sizes.get(txn.splitKey) ?? 0) < 2 ? { ...txn, splitKey: null } : txn,
  );
}
