import { NotificationType } from '../../entities/notification.entity';

/**
 * The preference switches a user sets, and which of them each kind of
 * notification follows.
 */
export type NotificationPreferenceKey =
  | 'statementUploaded'
  | 'importCommitted'
  | 'categoryChanges'
  | 'memberActivity'
  | 'dataDeleted'
  | 'workspaceUpdated'
  | 'parsingErrors'
  | 'importFailures'
  | 'uncategorizedItems'
  | 'subscriptionPrompts';

export const NOTIFICATION_PREFERENCE_KEYS: NotificationPreferenceKey[] = [
  'statementUploaded',
  'importCommitted',
  'categoryChanges',
  'memberActivity',
  'dataDeleted',
  'workspaceUpdated',
  'parsingErrors',
  'importFailures',
  'uncategorizedItems',
  'subscriptionPrompts',
];

export const NOTIFICATION_PREFERENCE_MAP: Record<NotificationType, NotificationPreferenceKey> = {
  [NotificationType.STATEMENT_UPLOADED]: 'statementUploaded',
  [NotificationType.IMPORT_COMMITTED]: 'importCommitted',
  [NotificationType.CATEGORY_CREATED]: 'categoryChanges',
  [NotificationType.CATEGORY_UPDATED]: 'categoryChanges',
  [NotificationType.CATEGORY_DELETED]: 'categoryChanges',
  [NotificationType.NOTE_MENTIONED]: 'memberActivity',
  [NotificationType.MEMBER_INVITED]: 'memberActivity',
  [NotificationType.MEMBER_JOINED]: 'memberActivity',
  [NotificationType.DATA_DELETED]: 'dataDeleted',
  [NotificationType.WORKSPACE_UPDATED]: 'workspaceUpdated',
  [NotificationType.PARSING_ERROR]: 'parsingErrors',
  [NotificationType.IMPORT_FAILED]: 'importFailures',
  [NotificationType.TRANSACTION_UNCATEGORIZED]: 'uncategorizedItems',
  [NotificationType.RECEIPT_UNCATEGORIZED]: 'uncategorizedItems',
  [NotificationType.PAYABLE_DUE_SOON]: 'workspaceUpdated',
  [NotificationType.PAYABLE_OVERDUE]: 'workspaceUpdated',
  [NotificationType.PAYABLE_MARKED_PAID]: 'workspaceUpdated',
  [NotificationType.BUDGET_WARNING]: 'workspaceUpdated',
  [NotificationType.TAX_THRESHOLD_WARNING]: 'workspaceUpdated',
  [NotificationType.TAX_THRESHOLD_REACHED]: 'workspaceUpdated',
  [NotificationType.TAX_DEADLINE_UPCOMING]: 'workspaceUpdated',
  [NotificationType.TAX_DEADLINE_OVERDUE]: 'workspaceUpdated',
  [NotificationType.TAX_RATES_OFFICIAL_CHANGED]: 'workspaceUpdated',
  [NotificationType.BUDGET_EXCEEDED]: 'workspaceUpdated',
  [NotificationType.SUBSCRIPTION_DETECTED]: 'subscriptionPrompts',
  [NotificationType.SUBSCRIPTION_UPCOMING]: 'workspaceUpdated',
  [NotificationType.SUBSCRIPTION_PRICE_CHANGED]: 'workspaceUpdated',
  [NotificationType.RULE_MATCHED]: 'workspaceUpdated',
};
