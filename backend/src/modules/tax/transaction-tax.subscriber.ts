import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  UpdateEvent,
} from 'typeorm';
import { Transaction } from '../../entities/transaction.entity';
import { toDateOnly } from './jurisdictions.service';
import { applyAssignment, assignmentInputOf, TaxAssignmentService } from './tax-assignment.service';

/** What the tax on a row depends on. */
const TAX_INPUTS = [
  'categoryId',
  'amount',
  'debit',
  'credit',
  'transactionDate',
  'transactionType',
  'transactionNature',
  'counterpartyCountry',
  'counterpartyVatId',
  'payeeId',
] as const satisfies ReadonlyArray<keyof Transaction>;

/** Tax figures a caller may have set itself in the same write (a split does). */
const TAX_OUTPUTS = ['taxRateId', 'taxAmount', 'taxSource'] as const;

function comparable(value: unknown): unknown {
  if (value instanceof Date) {
    return toDateOnly(value);
  }
  if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))) {
    return Number(value);
  }
  return value ?? null;
}

function changed(entity: Transaction, before: Transaction, field: keyof Transaction): boolean {
  const next = entity[field];
  return next !== undefined && comparable(next) !== comparable(before[field]);
}

/**
 * Assesses tax again whenever a saved edit changes what the tax depends on:
 * the category, the amount, the date, the other party. Without it, moving a
 * row from "Groceries" to "Office supplies" kept the rate of the old category,
 * and the return carried the stale figure.
 *
 * Only `save()` and `insert()` reach a subscriber; paths that write with `update()` call
 * `TaxAssignmentService.reassess` themselves. Rows in a filed return are left
 * alone — the edit guard refuses those changes before they get here.
 */
@Injectable()
export class TransactionTaxSubscriber implements EntitySubscriberInterface<Transaction> {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly taxAssignmentService: TaxAssignmentService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Transaction;
  }

  /** New rows created without their tax, and the inserts' query runners waiting to commit. */
  private readonly needsTax = new WeakSet<object>();
  private readonly pending = new WeakMap<object, Array<{ workspaceId: string; id: string }>>();
  private readonly logger = new Logger(TransactionTaxSubscriber.name);

  /**
   * A row created without its tax (a payment recorded from a wallet, an
   * approved receipt, a file import) is assessed once its insert commits. A
   * creator that assessed it set the tax fields and is left alone, as is loan
   * interest, which counts only with its payment. Assessed afterwards, on its
   * own connection: resolving inside the insert would hold one connection and
   * wait for another, and a burst of such inserts could exhaust the pool.
   */
  beforeInsert(event: InsertEvent<Transaction>): void {
    const entity = event.entity as Transaction | undefined;
    if (!entity?.workspaceId || entity.taxLocked || entity.loanInterestOfId) {
      return;
    }
    if (TAX_OUTPUTS.some(field => entity[field] !== undefined)) {
      return;
    }
    this.needsTax.add(entity);
  }

  afterInsert(event: InsertEvent<Transaction>): void {
    const entity = event.entity as Transaction | undefined;
    if (!(entity?.id && this.needsTax.has(entity))) {
      return;
    }
    const runner = event.queryRunner;
    const rows = this.pending.get(runner) ?? [];
    rows.push({ workspaceId: entity.workspaceId, id: entity.id });
    this.pending.set(runner, rows);
    if (!runner.isTransactionActive) {
      this.assessLater(runner);
    }
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    this.assessLater(event.queryRunner);
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.pending.delete(event.queryRunner);
  }

  private assessLater(runner: object): void {
    const rows = this.pending.get(runner);
    this.pending.delete(runner);
    if (!rows?.length) {
      return;
    }
    const byWorkspace = new Map<string, string[]>();
    for (const row of rows) {
      byWorkspace.set(row.workspaceId, [...(byWorkspace.get(row.workspaceId) ?? []), row.id]);
    }
    setImmediate(() => {
      for (const [workspaceId, ids] of byWorkspace) {
        this.taxAssignmentService.reassess(workspaceId, { ids }).catch((error: unknown) => {
          this.logger.warn(
            `Could not assess the tax of ${ids.length} new row(s): ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }
    });
  }

  async beforeUpdate(event: UpdateEvent<Transaction>): Promise<void> {
    const entity = event.entity as Transaction | undefined;
    const before = event.databaseEntity;
    if (!(entity?.workspaceId && before) || before.taxLocked || entity.taxLocked) {
      return;
    }
    if (!TAX_INPUTS.some(field => changed(entity, before, field))) {
      return;
    }
    if (TAX_OUTPUTS.some(field => changed(entity, before, field))) {
      return;
    }

    const merged = { ...before } as Transaction;
    for (const [field, value] of Object.entries(entity)) {
      if (value !== undefined) {
        (merged as unknown as Record<string, unknown>)[field] = value;
      }
    }
    applyAssignment(entity, await this.taxAssignmentService.resolve(assignmentInputOf(merged)));
  }
}
