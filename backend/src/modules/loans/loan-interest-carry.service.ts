import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { type EntityManager, Not, type Repository } from 'typeorm';
import { fromMinor } from '../../common/utils/money.util';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { Transaction } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { HELD_FOR_REREAD } from './loan-interest-carry';
import { loadInterest, type PaymentInterest } from './loan-payment-rows';

/** Where the interest of one held payment went. */
interface Carried {
  held: Transaction;
  interest: PaymentInterest;
  /** The payment's new version, or null when the statement no longer has it. */
  to: Transaction | null;
}

/**
 * Carries a loan split through a statement read again (deleteKeepingSplits
 * held its payments): the interest moves to the payment's new version, the
 * row with the same fingerprint the dedupe goes by, and the held payment goes.
 * A payment the statement no longer has goes with its interest, and the audit
 * trail says so.
 */
@Injectable()
export class LoanInterestCarryService {
  private readonly logger = new Logger(LoanInterestCarryService.name);

  constructor(
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly audit: AuditService,
  ) {}

  async reattach(workspaceId: string, statementId: string): Promise<number> {
    const held = await this.transactions.find({
      where: { workspaceId, statementId, duplicateMatchType: HELD_FOR_REREAD },
    });
    let carried = 0;
    for (const payment of held) {
      try {
        const result = await this.transactions.manager.transaction(manager =>
          this.carry(manager, payment),
        );
        if (result) {
          await this.record(result);
          carried++;
        }
      } catch (error) {
        // Left held: its interest still counts nowhere, and the next read tries again.
        this.logger.error(
          `Could not carry the loan split of ${payment.id} in ${workspaceId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    if (carried > 0) {
      await this.cache.set(`reports:version:${workspaceId}`, Date.now().toString(), 0);
    }
    return carried;
  }

  private async carry(manager: EntityManager, held: Transaction): Promise<Carried | null> {
    const repo = manager.getRepository(Transaction);
    const { workspaceId } = held;
    const interest = (await loadInterest(repo, workspaceId, [held.id])).get(held.id);
    if (!interest) {
      await repo.delete({ workspaceId, id: held.id });
      return null;
    }
    const to = await this.newVersionOf(repo, held);
    if (to) {
      // Flagged a repeat of the held row only: with it gone it is the payment again.
      if (to.duplicateOfId === held.id) {
        const taken = await repo.exists({
          where: { workspaceId, fingerprint: to.fingerprint ?? '', isDuplicate: false },
        });
        if (!taken) {
          Object.assign(to, { isDuplicate: false, duplicateOfId: null, duplicateConfidence: null });
          await repo.update(
            { workspaceId, id: to.id },
            { isDuplicate: false, duplicateOfId: null, duplicateConfidence: null },
          );
        }
      }
      await repo.update(
        { workspaceId, duplicateOfId: held.id, id: Not(to.id) },
        { duplicateOfId: to.id },
      );
      await repo.update(
        { workspaceId, loanInterestOfId: held.id },
        {
          loanInterestOfId: to.id,
          isVerified: to.isVerified,
          isDuplicate: to.isDuplicate,
          transactionDate: to.transactionDate,
        },
      );
    }
    // With no new version the interest goes with the payment (the FK cascades).
    await repo.delete({ workspaceId, id: held.id });
    return { held, interest, to };
  }

  /** The row the statement now has for the held payment: same account, same fingerprint. */
  private async newVersionOf(
    repo: Repository<Transaction>,
    held: Transaction,
  ): Promise<Transaction | null> {
    if (!held.fingerprint) {
      return null;
    }
    const candidates = await repo.find({
      where: {
        workspaceId: held.workspaceId,
        statementId: held.statementId ?? undefined,
        fingerprint: held.fingerprint,
        id: Not(held.id),
      },
      order: { createdAt: 'ASC' },
    });
    for (const candidate of candidates) {
      const own = await loadInterest(repo, held.workspaceId, [candidate.id]);
      if (
        candidate.walletId === held.walletId &&
        candidate.duplicateMatchType !== HELD_FOR_REREAD &&
        !candidate.splitGroupId &&
        !own.has(candidate.id)
      ) {
        return candidate;
      }
    }
    return null;
  }

  private async record({ held, interest, to }: Carried): Promise<void> {
    const meta = {
      operation: to ? 'loan_split_carried' : 'loan_rejoin',
      reason: 'statement_read_again',
      statementId: held.statementId,
      previousTransactionId: held.id,
      interestTransactionId: interest.id,
      interest: fromMinor(interest.minor),
    };
    await this.audit.createEvent({
      workspaceId: held.workspaceId,
      actorType: ActorType.SYSTEM,
      entityType: EntityType.TRANSACTION,
      entityId: to?.id ?? held.id,
      action: to ? AuditAction.UPDATE : AuditAction.DELETE,
      diff: { before: null, after: meta },
      meta,
      severity: to ? undefined : Severity.WARN,
      isUndoable: false,
    });
  }
}
