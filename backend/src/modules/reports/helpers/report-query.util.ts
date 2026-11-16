import type { Cache } from 'cache-manager';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { onlyFlows } from '../../../common/utils/counted-transactions.util';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import type { Transaction } from '../../../entities/transaction.entity';
import type { AuditService } from '../../audit/audit.service';

/** Cached reports are keyed by this version; TransactionsService bumps it on every edit. */
export async function getReportsVersion(cacheManager: Cache, workspaceId: string): Promise<string> {
  const key = `reports:version:${workspaceId}`;
  let version = await cacheManager.get<string>(key);
  if (!version) {
    version = Date.now().toString();
    await cacheManager.set(key, version, 0); // No expiry (until invalidated)
  }
  return version;
}

/**
 * Log report generation to audit log
 */
export async function logReportGeneration(
  auditService: AuditService,
  workspaceId: string,
  reportType: string,
  reportDate: string,
): Promise<void> {
  // Audit: record report exports for traceability.
  await auditService.createEvent({
    workspaceId,
    actorType: ActorType.SYSTEM,
    actorId: null,
    entityType: EntityType.WORKSPACE,
    entityId: workspaceId,
    action: AuditAction.EXPORT,
    meta: {
      reportType,
      reportDate,
    },
  });
}

/**
 * What a report, export or summary counts: confirmed rows (a row waiting in
 * Review is listed elsewhere, never summed) that are not suspected
 * duplicates, not transfers between the user's own accounts and not on a
 * trashed statement. The trash check is a subquery so callers can still join
 * the statement under their own alias.
 */
export function countedTransactions(
  transactionRepository: Repository<Transaction>,
  workspaceId: string,
): SelectQueryBuilder<Transaction> {
  return onlyFlows(
    transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.workspaceId = :workspaceId', { workspaceId }),
    'transaction',
  ).andWhere('transaction.transferPairId IS NULL');
}
