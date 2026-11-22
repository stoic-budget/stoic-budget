import { type FindOptionsWhere, In, type Repository } from 'typeorm';
import { Transaction } from '../../entities/transaction.entity';

/**
 * `duplicate_match_type` of a split loan payment held while its statement is
 * read again: flagged a duplicate meanwhile, so neither it nor its interest
 * counts twice, until its new version takes the interest over
 * (LoanInterestCarryService).
 */
export const HELD_FOR_REREAD = 'loan_split_reread';

/**
 * Deletes the rows a statement read again replaces (`where`, in the
 * workspace), but a loan payment with interest split off it: deleting it
 * would take the interest along. Such a payment is held instead, and once
 * the statement is read its new version (the row with its fingerprint)
 * carries the interest on. One whose interest is on a filed tax return is
 * left as it is, as a locked row is: the interest must not move or go.
 */
export async function deleteKeepingSplits(
  transactions: Repository<Transaction>,
  workspaceId: string,
  where: FindOptionsWhere<Transaction>,
): Promise<void> {
  const ids = (
    await transactions.find({ select: { id: true }, where: { ...where, workspaceId } })
  ).map(row => row.id);
  if (ids.length === 0) {
    return;
  }
  const interest = await transactions.find({
    select: { id: true, loanInterestOfId: true, taxLocked: true },
    where: { workspaceId, loanInterestOfId: In(ids) },
  });
  const kept = new Set(interest.filter(row => row.taxLocked).map(row => row.loanInterestOfId));
  const held = new Set(
    interest.map(row => row.loanInterestOfId as string).filter(id => !kept.has(id)),
  );
  if (held.size > 0) {
    await transactions.update(
      { workspaceId, id: In([...held]) },
      { isDuplicate: true, duplicateOfId: null, duplicateMatchType: HELD_FOR_REREAD },
    );
  }
  const gone = ids.filter(id => !(kept.has(id) || held.has(id)));
  if (gone.length > 0) {
    await transactions.delete({ workspaceId, id: In(gone) });
  }
}
