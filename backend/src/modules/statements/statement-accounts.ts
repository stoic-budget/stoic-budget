import { BadRequestException, Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { Wallet } from '../../entities';

const logger = new Logger('StatementAccounts');

/**
 * The account an upload was sent to (SimpleFIN mapping, a webhook default, the
 * upload form), kept only when it is one of this workspace's: a mapping left
 * pointing at a deleted account must not fail the upload.
 */
export async function accountOfUpload(
  wallets: Repository<Wallet>,
  walletId: string | undefined,
  workspaceId: string,
): Promise<string | null> {
  if (!walletId) {
    return null;
  }
  const exists = await wallets.exists({ where: { id: walletId, workspaceId } });
  if (!exists) {
    logger.warn(`[Statements] Upload named wallet ${walletId}, not in workspace ${workspaceId}`);
  }
  return exists ? walletId : null;
}

/** Who owns the wallet, or null when it is shared. */
export async function walletOwnerMemberId(
  wallets: Repository<Wallet>,
  walletId: string,
  workspaceId: string,
): Promise<string | null> {
  const wallet = await wallets.findOne({
    where: { id: walletId, workspaceId },
    select: {
      ownerMemberId: true,
    },
  });
  return wallet?.ownerMemberId ?? null;
}

/**
 * Refuses an entry made by hand (a manual expense) on an account that holds
 * another currency, as a bill paid from a wallet or a statement linked to an
 * account is refused: a dollar expense cannot leave a euro account. An account
 * of another workspace is left to `accountOfUpload`, which drops it.
 */
export async function assertAccountCurrency(
  wallets: Repository<Wallet>,
  walletId: string | null | undefined,
  workspaceId: string,
  currency: string,
): Promise<void> {
  if (!walletId) {
    return;
  }
  const wallet = await wallets.findOne({
    where: { id: walletId, workspaceId },
    select: { id: true, currency: true },
  });
  const walletCurrency = wallet?.currency.toUpperCase();
  if (walletCurrency && walletCurrency !== currency.toUpperCase()) {
    throw new BadRequestException(
      appError('EXPENSE_WALLET_CURRENCY_MISMATCH', { walletCurrency, currency }),
    );
  }
}
