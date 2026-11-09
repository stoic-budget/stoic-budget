import type { Repository } from 'typeorm';
import {
  assertApiKeyScopes,
  type PermissionSubject,
} from '../../../common/authz/request-permissions';
import { Permission } from '../../../common/enums/permissions.enum';
import { ensureCanEdit } from '../../../common/utils/ensure-can-edit.util';
import type { WorkspaceMember } from '../../../entities/workspace-member.entity';

/**
 * An app import books statements on accounts it may create, and budgets when
 * a plan comes along: the rights of each, for the import and for its undo.
 */
export async function ensureAppImportPermission(
  members: Repository<WorkspaceMember>,
  userId: string,
  workspaceId: string,
  apiKey: PermissionSubject['apiKey'],
  withBudgets: boolean,
): Promise<void> {
  assertApiKeyScopes(
    [
      Permission.STATEMENT_UPLOAD,
      Permission.WALLET_CREATE,
      ...(withBudgets ? [Permission.BUDGET_CREATE] : []),
    ],
    apiKey,
  );
  await ensureCanEdit(
    members,
    workspaceId,
    userId,
    'canEditStatements',
    'STATEMENTS_EDIT_FORBIDDEN',
  );
  if (withBudgets) {
    await ensureCanEdit(
      members,
      workspaceId,
      userId,
      'canEditDataEntry',
      'DATA_ENTRY_EDIT_FORBIDDEN',
    );
  }
}
