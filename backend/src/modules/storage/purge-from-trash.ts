import { In, type Repository } from 'typeorm';
import { assertRowsRemovable } from '../../common/utils/tax-lock.util';
import type { Statement } from '../../entities/statement.entity';
import type { Transaction } from '../../entities/transaction.entity';
import type { StatementsService } from '../statements/statements.service';

/**
 * Deletes trashed statements for good. A row on a filed return refuses the
 * whole batch before any is deleted, as moving to the trash does: no
 * half-emptied trash behind an error. Each one is still checked to be in the
 * trash when it goes (it may be restored meanwhile).
 */
export async function purgeFromTrash(
  statementsService: StatementsService,
  transactions: Repository<Transaction>,
  statements: Pick<Statement, 'id' | 'workspaceId'>[],
  userId: string,
): Promise<void> {
  if (statements.length === 0) {
    return;
  }
  await assertRowsRemovable(transactions, { statementId: In(statements.map(st => st.id)) });
  for (const st of statements) {
    await statementsService.permanentDelete(st.id, userId, st.workspaceId, { fromTrash: true });
  }
}
