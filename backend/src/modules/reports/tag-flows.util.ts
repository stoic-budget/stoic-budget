import type { Repository, SelectQueryBuilder } from 'typeorm';
import { onlyFlows } from '../../common/utils/counted-transactions.util';
import {
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
} from '../../common/utils/transaction-privacy.util';
import type { Transaction } from '../../entities/transaction.entity';
import { TRANSACTION_TAG_PAIRS_SQL } from '../tags/transaction-tag-pairs.util';

/**
 * The workspace's income and spending rows as the analytics sankeys count
 * them, aliased `t` (with its statement as `statement`): `onlyFlows`, no
 * transfers between own accounts. Direction, dates and the page's filters are
 * the caller's.
 */
export function countedFlowsQuery(
  repository: Repository<Transaction>,
  workspaceId: string,
  viewerMemberId: string | null,
): SelectQueryBuilder<Transaction> {
  const query = repository
    .createQueryBuilder('t')
    .leftJoin('t.statement', 'statement')
    .where('t.workspace_id = :workspaceId', { workspaceId })
    .andWhere('t.is_duplicate = false')
    .andWhere('(t.statement_id IS NULL OR statement.deleted_at IS NULL)')
    // Money moved between the user's own accounts is neither spending nor income.
    .andWhere('t.transfer_pair_id IS NULL')
    .setParameter(PRIVACY_VIEWER_PARAM, viewerMemberId);
  return onlyFlows(query, 't');
}

/**
 * Each row of `countedFlowsQuery` once per tag it carries, its own or its
 * statement's or receipt's, as `tp.tag_id`. Another member's private rows stay
 * out: which tag they carry is what they hide. Reports' By tag and the tag
 * page both read tags through here, so the two agree.
 */
export function perTag(query: SelectQueryBuilder<Transaction>): SelectQueryBuilder<Transaction> {
  return query
    .innerJoin(`(${TRANSACTION_TAG_PAIRS_SQL})`, 'tp', 'tp.transaction_id = t.id')
    .andWhere(readablePrivateSql('t'));
}
