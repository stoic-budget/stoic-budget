import type { Repository } from 'typeorm';
import { withoutNullsOnRequired } from '../../common/effect/without-nulls';
import type { UpdateWalletBody } from '../../contracts';
import { LoanTerms } from '../../entities/loan-terms.entity';
import { DEBT_WALLET_TYPES, type Wallet } from '../../entities/wallet.entity';

/**
 * Applies a change to an account and saves it. A loan or credit card that
 * becomes another type loses its loan terms in the same transaction: they
 * describe a debt the account no longer is, and only a debt account takes them.
 */
export async function saveWalletChange(
  repository: Repository<Wallet>,
  wallet: Wallet,
  change: UpdateWalletBody,
): Promise<Wallet> {
  const wasDebt = DEBT_WALLET_TYPES.includes(wallet.type);
  Object.assign(wallet, withoutNullsOnRequired(repository.metadata, change));
  if (!wasDebt || DEBT_WALLET_TYPES.includes(wallet.type)) {
    return repository.save(wallet);
  }
  return repository.manager.transaction(async manager => {
    await manager.delete(LoanTerms, { walletId: wallet.id, workspaceId: wallet.workspaceId });
    return manager.save(wallet);
  });
}
