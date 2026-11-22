import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntitySubscriberInterface, RemoveEvent } from 'typeorm';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Wallet } from '../../entities/wallet.entity';
import { AuditService } from '../audit/audit.service';

interface Unlinked {
  id: string;
  payment_id: string;
  workspace_id: string;
}

/**
 * A loan account deleted keeps the interest split off its payments: the
 * payment trigger unlinks it, and it stays a plain expense with no account,
 * as the payment stays a row with none (their wallet goes NULL). Here the
 * audit trail records each interest row that was unlinked.
 */
@Injectable()
export class LoanAccountRemovalSubscriber implements EntitySubscriberInterface<Wallet> {
  private readonly unlinking = new WeakMap<object, Unlinked[]>();

  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly audit: AuditService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Wallet;
  }

  async beforeRemove(event: RemoveEvent<Wallet>): Promise<void> {
    const wallet = event.entity;
    if (!(wallet?.id && wallet.workspaceId)) {
      return;
    }
    const rows: Unlinked[] = await event.manager.query(
      `SELECT interest."id", interest."loan_interest_of_id" AS "payment_id", interest."workspace_id"
         FROM "transactions" interest
         JOIN "transactions" payment ON payment."id" = interest."loan_interest_of_id"
        WHERE payment."wallet_id" = $1 AND payment."workspace_id" = $2`,
      [wallet.id, wallet.workspaceId],
    );
    if (rows.length > 0) {
      this.unlinking.set(wallet, rows);
    }
  }

  async afterRemove(event: RemoveEvent<Wallet>): Promise<void> {
    const rows = event.entity ? this.unlinking.get(event.entity) : undefined;
    for (const row of rows ?? []) {
      const meta = {
        operation: 'loan_interest_unlinked',
        reason: 'loan_account_deleted',
        walletId: event.entityId as string,
        paymentTransactionId: row.payment_id,
      };
      await this.audit.createEvent({
        workspaceId: row.workspace_id,
        actorType: ActorType.SYSTEM,
        entityType: EntityType.TRANSACTION,
        entityId: row.id,
        action: AuditAction.UPDATE,
        diff: { before: { loanInterestOfId: row.payment_id }, after: { loanInterestOfId: null } },
        meta,
        isUndoable: false,
      });
    }
  }
}
