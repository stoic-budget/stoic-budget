import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { NotificationCategory, NotificationType } from '../../entities/notification.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import type { RuleMatchedEvent } from './events/notification-events';
import type { NotificationParams } from './notification-params';
import { NotificationsService } from './notifications.service';

/**
 * Sends what a rule asked for when a new row matched it: to the one member it
 * names (looked up in the row's workspace), or to every member. Which rows
 * and rules qualify, and that each pair is sent once, is the classification
 * side's (`RuleNotifyService`).
 */
@Injectable()
export class RuleNotificationListener {
  private readonly logger = new Logger(RuleNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
  ) {}

  @OnEvent('rule.matched')
  async handleRuleMatched(event: RuleMatchedEvent): Promise<void> {
    try {
      await this.send(event);
    } catch (error) {
      this.logger.error(
        `Failed to send the notification of rule ${event.ruleId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async send(event: RuleMatchedEvent): Promise<void> {
    const messageParams: NotificationParams = {
      rule: event.ruleName,
      payee: event.payee,
      amount: { kind: 'money', amount: event.amount, currency: event.currency },
      ...(event.account ? { account: event.account } : {}),
    };
    const payload = {
      workspaceId: event.workspaceId,
      type: NotificationType.RULE_MATCHED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      messageKey: event.account ? ('rule.matched' as const) : ('rule.matched.no_account' as const),
      messageParams,
      entityType: 'transaction',
      entityId: event.transactionId,
      meta: {
        ruleId: event.ruleId,
        transactionId: event.transactionId,
        statementId: event.statementId,
      },
    };
    if (event.memberId === null) {
      await this.notificationsService.createForWorkspaceMembers(payload);
      return;
    }
    const member = await this.memberRepository.findOne({
      where: { id: event.memberId, workspaceId: event.workspaceId },
      select: { id: true, userId: true },
    });
    // The member left the workspace since the rule was saved: nobody to tell.
    if (member) {
      await this.notificationsService.create({ ...payload, recipientId: member.userId });
    }
  }
}
