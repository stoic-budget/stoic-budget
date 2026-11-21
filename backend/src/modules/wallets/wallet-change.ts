import type { Repository } from 'typeorm';
import { withoutNullsOnRequired } from '../../common/effect/without-nulls';
import type { UpdateWalletBody } from '../../contracts';
import { LoanTerms } from '../../entities/loan-terms.entity';
import { DEBT_WALLET_TYPES, Wallet } from '../../entities/wallet.entity';

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
    // The same row lock a save of loan terms holds (loan-terms.service.ts): terms
    // saved while the type changed are in before this delete, never after it.
    await manager.findOne(Wallet, {
      where: { id: wallet.id, workspaceId: wallet.workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    await manager.delete(LoanTerms, { walletId: wallet.id, workspaceId: wallet.workspaceId });
    return manager.save(wallet);
  });
}
