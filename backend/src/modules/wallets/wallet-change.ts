import type { Repository } from 'typeorm';
import { withoutNullsOnRequired } from '../../common/effect/without-nulls';
import { assertFound } from '../../common/utils/assert-found.util';
import type { UpdateWalletBody } from '../../contracts';
import { LoanTerms } from '../../entities/loan-terms.entity';
import { DEBT_WALLET_TYPES, Wallet } from '../../entities/wallet.entity';
import { endLoanReminders } from '../loans/loan-reminder-series';
import { creditLimitPatch, refuseCardOnlyViolation } from './wallet-credit-limit';

/**
 * Applies a change to an account and saves it. Read, decide and write happen
 * under a row lock: a type change and a new limit sent at once are applied one
 * after the other, and each writes only the columns it names, so a stale copy
 * never puts the old type back. A loan or credit card that becomes another type
 * loses its loan terms in the same transaction: they describe a debt the account
 * no longer is, and only a debt account takes them; its payment bills stop
 * with them. The lock is the one a save
 * of loan terms holds (loan-terms.service.ts), so terms saved while the type
 * changed are in before the delete, never after it.
 */
export function saveWalletChange(
  repository: Repository<Wallet>,
  id: string,
  workspaceId: string,
  change: UpdateWalletBody,
  entityName: string,
): Promise<Wallet> {
  const { creditLimit, ...fields } = change;
  return repository.manager
    .transaction(async manager => {
      const wallets = manager.getRepository(Wallet);
      const wallet = await wallets.findOne({
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      assertFound(wallet, entityName);
      const patch = withoutNullsOnRequired(wallets.metadata, {
        ...fields,
        ...creditLimitPatch(fields.type ?? wallet.type, creditLimit),
      });
      const columns = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(columns).length > 0) {
        await wallets.update({ id, workspaceId }, columns);
      }
      const leavesDebt =
        DEBT_WALLET_TYPES.includes(wallet.type) &&
        fields.type != null &&
        !DEBT_WALLET_TYPES.includes(fields.type);
      if (leavesDebt) {
        await manager.delete(LoanTerms, { walletId: id, workspaceId });
        await endLoanReminders(manager, workspaceId, id);
      }
      return wallets.findOneByOrFail({ id, workspaceId });
    })
    .catch(refuseCardOnlyViolation);
}
