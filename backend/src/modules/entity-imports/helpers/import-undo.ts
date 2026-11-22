import { type EntityManager, In } from 'typeorm';
import { Budget } from '../../../entities/budget.entity';
import { Client } from '../../../entities/client.entity';
import type { ImportBatch, ImportCreatedRef } from '../../../entities/import-batch.entity';
import { InvestmentHolding } from '../../../entities/investment-holding.entity';
import { InvestmentTrade } from '../../../entities/investment-trade.entity';
import { Invoice } from '../../../entities/invoice.entity';
import { Payable } from '../../../entities/payable.entity';
import { Statement } from '../../../entities/statement.entity';
import { Subscription } from '../../../entities/subscription.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { removeImportedHoldings, restoreUpdatedRefs, type UndoneHoldings } from './undo-holdings';

/** The import batch target of an import from another budgeting app. */
export const APP_IMPORT_TARGET = 'apps';

/**
 * Removes what a batch created and puts back what it changed. Statements go
 * with their rows. Categories, payees and accounts an app import created go
 * too, unless something added since still uses them (a row booked by hand on
 * a new account keeps that account). Other imports keep their categories.
 * A holding the batch created goes once its trades are gone, unless traded on since.
 */
export async function removeImportBatch(
  manager: EntityManager,
  batch: ImportBatch,
): Promise<{ removed: number; holdings: UndoneHoldings }> {
  const { workspaceId } = batch;
  let count = 0;
  const byKind = (kind: ImportCreatedRef['kind']) =>
    batch.createdRefs.filter(ref => ref.kind === kind).map(ref => ref.id);
  const statements = byKind('statement');
  if (statements.length) {
    // A leg left behind (a row of another import or statement this batch paired) is no transfer any more.
    await manager.query(
      `UPDATE transactions SET transfer_pair_id = NULL, transfer_pair_source = NULL
        WHERE workspace_id = $1 AND (statement_id IS NULL OR statement_id <> ALL($2::uuid[]))
          AND transfer_pair_id IN (SELECT transfer_pair_id FROM transactions
                                    WHERE workspace_id = $1 AND statement_id = ANY($2::uuid[]))`,
      [workspaceId, statements],
    );
    await manager.getRepository(Transaction).delete({ workspaceId, statementId: In(statements) });
    count +=
      (await manager.getRepository(Statement).delete({ workspaceId, id: In(statements) }))
        .affected ?? 0;
  }
  for (const [kind, entity] of [
    ['invoice', Invoice],
    ['payable', Payable],
    ['subscription', Subscription],
    ['budget', Budget],
    ['client', Client],
    ['metal_lot', InvestmentHolding],
    ['investment_trade', InvestmentTrade],
  ] as const) {
    const ids = byKind(kind);
    if (ids.length) {
      count +=
        (await manager.getRepository(entity).delete({ workspaceId, id: In(ids) })).affected ?? 0;
    }
  }
  const holdings = await removeImportedHoldings(manager, workspaceId, byKind('investment_holding'));
  count += holdings.removed;
  await restoreUpdatedRefs(manager, workspaceId, batch.updatedRefs);
  if (batch.target === APP_IMPORT_TARGET) {
    count += await removeUnused(manager, workspaceId, 'payees', byKind('payee'), ['payee_aliases']);
    // Subcategories were created after their groups: newest first frees the groups.
    count += await removeUnused(
      manager,
      workspaceId,
      'categories',
      byKind('category').reverse(),
      [],
    );
    count += await removeUnused(manager, workspaceId, 'wallets', byKind('wallet'), []);
  }
  return { removed: count, holdings };
}

/** Single-column foreign keys pointing at `table`, read from the catalogue. */
async function referencesTo(
  manager: EntityManager,
  table: string,
): Promise<Array<{ source: string; column: string }>> {
  return manager.query(
    `SELECT cl.relname AS source, att.attname AS "column"
       FROM pg_constraint c
       JOIN pg_class cl ON cl.oid = c.conrelid
       JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.confrelid = $1::regclass AND cardinality(c.conkey) = 1`,
    [table],
  );
}

const quoted = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Deletes each of `ids` that no row anywhere points at any more, except the
 * tables that only hang off the record (`owned`, removed with it).
 */
async function removeUnused(
  manager: EntityManager,
  workspaceId: string,
  table: 'payees' | 'categories' | 'wallets',
  ids: string[],
  owned: string[],
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  const references = (await referencesTo(manager, table)).filter(
    ref => !owned.includes(ref.source),
  );
  let removed = 0;
  for (const id of ids) {
    let used = false;
    for (const ref of references) {
      const rows = await manager.query(
        `SELECT 1 FROM ${quoted(ref.source)} WHERE ${quoted(ref.column)} = $1 LIMIT 1`,
        [id],
      );
      if (rows.length > 0) {
        used = true;
        break;
      }
    }
    if (!used) {
      const result = await manager.query(
        `DELETE FROM ${quoted(table)} WHERE id = $1 AND workspace_id = $2`,
        [id, workspaceId],
      );
      removed += Array.isArray(result) ? Number(result[1] ?? 0) : 0;
    }
  }
  return removed;
}
