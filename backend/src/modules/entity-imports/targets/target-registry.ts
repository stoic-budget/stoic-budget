import { Permission } from '../../../common/enums/permissions.enum';
import { EntityType } from '../../../entities/audit-event.entity';
import type { ImportCreatedRef } from '../../../entities/import-batch.entity';
import type { ImportTargetKind } from '../target-aliases';

/**
 * The scope an API key needs to import (or undo) each target: the permission
 * the matching create route asks for. Roles are checked by the service.
 */
export const IMPORT_SCOPES: Record<ImportTargetKind, Permission> = {
  transactions: Permission.STATEMENT_UPLOAD,
  payables: Permission.PAYABLE_CREATE,
  subscriptions: Permission.SUBSCRIPTION_CREATE,
  invoices: Permission.INVOICE_CREATE,
  budgets: Permission.BUDGET_CREATE,
  metals: Permission.WALLET_CREATE,
  trades: Permission.WALLET_CREATE,
};

/** The records a run of each target hands back as "what was imported". */
export const CREATED_KIND: Record<ImportTargetKind, ImportCreatedRef['kind']> = {
  transactions: 'statement',
  payables: 'payable',
  subscriptions: 'subscription',
  invoices: 'invoice',
  budgets: 'budget',
  metals: 'metal_lot',
  trades: 'investment_trade',
};

/** The audit entity an import is recorded under; null where there is none yet. */
export const AUDIT_ENTITY: Record<ImportTargetKind, EntityType | null> = {
  transactions: EntityType.STATEMENT,
  payables: EntityType.PAYABLE,
  subscriptions: EntityType.SUBSCRIPTION,
  invoices: EntityType.INVOICE,
  budgets: EntityType.BUDGET,
  metals: null,
  trades: null,
};
