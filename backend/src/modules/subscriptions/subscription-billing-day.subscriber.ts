import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { Subscription } from '../../entities/subscription.entity';
import { billingDayFor } from './charge-calendar.util';

/**
 * Keeps a subscription's billing day in step with its next charge date on
 * every path that saves it (the form, detection, a table's write-back, the
 * daily advance), so the day a person chose survives a short month (#596).
 */
@Injectable()
export class SubscriptionBillingDaySubscriber implements EntitySubscriberInterface<Subscription> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Subscription;
  }

  beforeInsert(event: InsertEvent<Subscription>): void {
    const row = event.entity;
    row.billingDay = billingDayFor(row.nextChargeDate, {
      frequency: row.frequency,
      billingDay: null,
    });
  }

  beforeUpdate(event: UpdateEvent<Subscription>): void {
    const row = event.entity as Subscription | undefined;
    if (!row?.frequency || row.nextChargeDate === undefined) return;
    const before = event.databaseEntity as Subscription | undefined;
    row.billingDay = billingDayFor(row.nextChargeDate, {
      frequency: row.frequency,
      billingDay: row.billingDay ?? before?.billingDay ?? null,
    });
  }
}
