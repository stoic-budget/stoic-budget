import type { Logger } from '@nestjs/common';
import { EntityType } from '../../entities/audit-event.entity';
import {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '../../entities/notification.entity';
import type { Payable } from '../../entities/payable.entity';
import type { NotificationsService } from '../notifications/notifications.service';

/** Tells the workspace a bill was paid; a failed notice never fails the payment. */
export async function notifyMarkedPaid(
  notifications: NotificationsService,
  logger: Logger,
  saved: Payable,
  userId: string,
): Promise<void> {
  try {
    await notifications.createForWorkspaceMembers({
      workspaceId: saved.workspaceId,
      actorId: userId,
      type: NotificationType.PAYABLE_MARKED_PAID,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: NotificationSeverity.INFO,
      messageKey: 'payable.marked_paid',
      messageParams: { vendor: saved.vendor },
      entityType: EntityType.PAYABLE,
      entityId: saved.id,
      meta: {
        payableId: saved.id,
        direction: saved.direction,
      },
    });
  } catch (error) {
    logger.warn(
      `Failed to send payable paid notification for ${saved.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
