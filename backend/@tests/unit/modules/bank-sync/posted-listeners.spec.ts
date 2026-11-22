import { EVENT_LISTENER_METADATA } from '@nestjs/event-emitter';
import { PayablesEventsListener } from '../../../../src/modules/payables/payables-events.listener';
import { SubscriptionAutoLinkSubscriber } from '../../../../src/modules/subscriptions/subscription-autolink.subscriber';
import { SubscriptionEventsListener } from '../../../../src/modules/subscriptions/subscription-events.listener';

/** The events a listener method is registered for. */
const eventsOf = (method: unknown): unknown[] =>
  (Reflect.getMetadata(EVENT_LISTENER_METADATA, method as object) ?? []).map(
    (entry: { event: unknown }) => entry.event,
  );

/**
 * A pending row the bank booked is updated in place, so no import event and no
 * insert subscriber sees it: everything an import does for a new row has to
 * listen to `transactions.posted` as well.
 */
describe('listeners of a booked pending row', () => {
  it('links a bill or receivable paid without a bank row to it', () => {
    expect(eventsOf(PayablesEventsListener.prototype.handleImportCommitted)).toEqual(
      expect.arrayContaining(['import.committed', 'transactions.posted']),
    );
  });

  it('runs subscription detection again', () => {
    expect(eventsOf(SubscriptionEventsListener.prototype.handleImportCommitted)).toEqual(
      expect.arrayContaining(['import.committed', 'transactions.posted']),
    );
  });

  it('makes it a payment of the subscription its payee is linked to', () => {
    expect(eventsOf(SubscriptionAutoLinkSubscriber.prototype.linkPosted)).toEqual([
      'transactions.posted',
    ]);
  });
});
