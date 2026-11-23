import type { EntityManager } from 'typeorm';
import { Category } from '../../entities/category.entity';
import type { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import type { TaxAssignmentService } from '../tax/tax-assignment.service';

/**
 * The receipt page sends every field on each save, the category included. A
 * category equal to the one stored on the receipt is no choice (#688): left
 * out, so the receipt does not mark it manual or copy it back onto a row whose
 * category was changed in Review or on the transaction since.
 */
/** The row fields a receipt edit writes, without its category unless the edit chose one. */
export function categoryIfEdited<T extends Record<string, unknown>>(
  edits: Record<string, unknown>,
  fields: T,
): T {
  if (edits.categoryId !== undefined) {
    return fields;
  }
  const { categoryId: _id, categorySource: _source, categoryReason: _reason, ...rest } = fields;
  return rest as T;
}

export function categoryChangesOnly(
  edits: Record<string, unknown>,
  stored: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (
    edits.categoryId === undefined ||
    (edits.categoryId || null) !== (stored?.categoryId ?? null)
  ) {
    return edits;
  }
  const { categoryId: _same, ...rest } = edits;
  return rest;
}

/**
 * A scan receipt is converted into a statement before the user ever opens it,
 * so the statement carries the fallback category picked at conversion time.
 * When the user then picks a category on the receipt, the statement has to
 * follow — otherwise the choice is invisible everywhere the statement is shown.
 */
export async function syncStatementCategory(
  manager: EntityManager,
  receipt: Receipt,
  workspaceId: string,
  taxAssignmentService?: TaxAssignmentService,
): Promise<void> {
  const categoryId = receipt.parsedData?.categoryId;
  if (!(receipt.statementId && categoryId)) {
    return;
  }

  const category = await manager.getRepository(Category).findOne({
    where: { id: categoryId, workspaceId },
    select: {
      id: true,
    },
  });
  if (!category) {
    return;
  }

  const statement = await manager.getRepository(Statement).findOne({
    where: { id: receipt.statementId, workspaceId },
  });
  if (!statement) {
    return;
  }

  await manager
    .getRepository(Statement)
    .update({ id: statement.id, workspaceId }, { categoryId: category.id });

  // The dashboard aggregates by transaction category, so the transaction the
  // scan produced has to follow the receipt too — otherwise the spend stays
  // filed under the fallback category picked at conversion time. Statements
  // parsed from a bank file carry unrelated transactions and are left alone.
  if (statement.parsingDetails?.detectedBy === 'receipt-scan') {
    // Rows on a filed tax return keep the category they were filed under.
    await manager.getRepository(Transaction).update(
      { statementId: statement.id, workspaceId, taxLocked: false },
      {
        categoryId: category.id,
        categorySource: receipt.parsedData?.categorySource ?? null,
        categoryReason: receipt.parsedData?.categoryReason ?? null,
      },
    );
    // update() skips the tax subscriber; the new category may carry another rate.
    await taxAssignmentService?.reassess(workspaceId, { statementId: statement.id });
  }
}
