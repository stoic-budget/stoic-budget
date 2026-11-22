import { NotFoundException } from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';
import type { WalletType } from '../../../entities/wallet.entity';
import { nameKey } from '../helpers/import-values';
import type { AppTxn } from './app-model';

export interface ExistingWallet {
  id: string;
  name: string;
  currency: string;
  ownerMemberId: string | null;
  /**
   * An earlier app import created it with no opening balance (the other side
   * of a transfer, say): its own export's opening balance still applies.
   */
  takesOpening?: boolean;
}

export interface PlannedAccount {
  /** `nameKey` of the source app's account name. */
  key: string;
  name: string;
  /** The workspace account the rows go to; null until a new one is created. */
  walletId: string | null;
  ownerMemberId: string | null;
  status: 'created' | 'matched';
  currency: string;
  type: WalletType;
  /** Opening balance for a new account, or one that `takesOpening`; any other matched one keeps its own. */
  opening: number;
  takesOpening: boolean;
  /** Opening-balance rows a matched account left out. */
  openingsSkipped: number;
}

export interface AccountChoices {
  /** Fallback currency of a new account whose rows name none. */
  currency: string;
  /** Source account name → workspace account id, or null to create one. Missing: by name. */
  accounts: Record<string, string | null>;
}

/** The names a row's payee could resolve to as an account: the file's accounts and the workspace's. */
export function knownAccountKeys(txns: AppTxn[], wallets: ExistingWallet[]): Set<string> {
  return new Set([
    ...txns.map(txn => nameKey(txn.account)),
    ...txns.filter(txn => txn.transferTo).map(txn => nameKey(txn.transferTo ?? '')),
    ...wallets.map(wallet => nameKey(wallet.name)),
  ]);
}

/** The other account of a transfer row, as a key, or null for an ordinary row. */
export function transferKeyOf(txn: AppTxn, known: Set<string>): string | null {
  const own = nameKey(txn.account);
  const other = txn.transferTo
    ? nameKey(txn.transferTo)
    : txn.payeeMayBeAccount && known.has(nameKey(txn.payee))
      ? nameKey(txn.payee)
      : null;
  return other && other !== own ? other : null;
}

/**
 * Every account the files name — the rows' own, and the other side of each
 * transfer — matched to a workspace account by the person's choice or by
 * name, or planned as a new one.
 */
export function planAccounts(
  txns: AppTxn[],
  wallets: ExistingWallet[],
  types: Map<string, WalletType>,
  choices: AccountChoices,
): Map<string, PlannedAccount> {
  const known = knownAccountKeys(txns, wallets);
  const names = new Map<string, string>();
  const currencies = new Map<string, string>();
  for (const txn of txns) {
    names.set(nameKey(txn.account), names.get(nameKey(txn.account)) ?? txn.account);
    if (txn.currency && !currencies.has(nameKey(txn.account))) {
      currencies.set(nameKey(txn.account), txn.currency);
    }
    const other = transferKeyOf(txn, known);
    if (other && !names.has(other)) {
      names.set(other, txn.transferTo ?? txn.payee);
    }
    if (other && txn.arrived?.currency && !currencies.has(other)) {
      currencies.set(other, txn.arrived.currency);
    }
  }
  const byKey = new Map(wallets.map(wallet => [nameKey(wallet.name), wallet]));
  const byId = new Map(wallets.map(wallet => [wallet.id, wallet]));
  const chosen = new Map(Object.entries(choices.accounts).map(([name, id]) => [nameKey(name), id]));
  const plan = new Map<string, PlannedAccount>();
  for (const [key, name] of names) {
    const choice = chosen.get(key);
    const wallet =
      typeof choice === 'string' ? byId.get(choice) : choice === null ? null : byKey.get(key);
    if (typeof choice === 'string' && !wallet) {
      throw new NotFoundException(appError('WALLET_NOT_FOUND'));
    }
    plan.set(key, {
      key,
      name,
      walletId: wallet?.id ?? null,
      ownerMemberId: wallet?.ownerMemberId ?? null,
      status: wallet ? 'matched' : 'created',
      currency: (wallet?.currency ?? currencies.get(key) ?? choices.currency).toUpperCase(),
      type: types.get(name) ?? 'checking',
      opening: 0,
      takesOpening: wallet?.takesOpening === true,
      openingsSkipped: 0,
    });
  }
  for (const txn of txns.filter(item => item.opening)) {
    const account = plan.get(nameKey(txn.account));
    if (account?.status === 'created' || account?.takesOpening) {
      account.opening = Math.round((account.opening + txn.amount) * 100) / 100;
    } else if (account) {
      account.openingsSkipped += 1;
    }
  }
  return plan;
}
