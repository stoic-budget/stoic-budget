import { RuleNotificationListener } from '@/modules/notifications/rule-notification.listener';
import type { RuleMatchedEvent } from '@/modules/notifications/events/notification-events';

describe('RuleNotificationListener', () => {
  const event: RuleMatchedEvent = {
    workspaceId: 'workspace-1',
    ruleId: 'rule-notify',
    ruleName: 'Tell me about ACME',
    memberId: null,
    transactionId: 'row-4',
    statementId: 'statement-1',
    payee: 'ACME Store - Wireless Buds',
    amount: 25,
    currency: 'EUR',
    account: 'Everyday Account',
  };
  const setUp = () => {
    const notifications = { createForWorkspaceMembers: vi.fn(), create: vi.fn() };
    const listener = new RuleNotificationListener(notifications as never, {} as never);
    return { listener, notifications };
  };

  it('names the row of one match', async () => {
    const { listener, notifications } = setUp();
    await listener.handleRuleMatched(event);

    expect(notifications.createForWorkspaceMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        messageKey: 'rule.matched',
        entityType: 'transaction',
        entityId: 'row-4',
      }),
    );
  });

  it('counts the rows past the limit, linked to their statement, naming no row', async () => {
    const { listener, notifications } = setUp();
    await listener.handleRuleMatched({ ...event, more: 27 });

    const [payload] = notifications.createForWorkspaceMembers.mock.calls[0];
    expect(payload).toMatchObject({
      messageKey: 'rule.matched.more',
      messageParams: { rule: 'Tell me about ACME', count: 27 },
      entityType: 'statement',
      entityId: 'statement-1',
    });
    expect(payload.messageParams).not.toHaveProperty('payee');
  });
});
