import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { Receipt } from '../../entities/receipt.entity';
import { Workspace } from '../../entities/workspace.entity';

/**
 * A receipt that states no currency is in its workspace's currency (#685).
 * Recognition returns only what the document says; every way a receipt is
 * stored (a scan, a photo from Telegram, a mail) passes through here, so the
 * receipt page, Review and approval all read the workspace's code rather than
 * the installation's USD. Only `save()` reaches a subscriber.
 */
@Injectable()
export class ReceiptCurrencySubscriber implements EntitySubscriberInterface<Receipt> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Receipt;
  }

  async beforeInsert(event: InsertEvent<Receipt>): Promise<void> {
    await this.fillCurrency(event.entity, event.manager);
  }

  async beforeUpdate(event: UpdateEvent<Receipt>): Promise<void> {
    await this.fillCurrency(event.entity as Receipt | undefined, event.manager);
  }

  private async fillCurrency(
    receipt: Receipt | undefined,
    manager: InsertEvent<Receipt>['manager'],
  ): Promise<void> {
    const parsed = receipt?.parsedData;
    if (!(receipt?.workspaceId && parsed) || parsed.currency) {
      return;
    }
    const workspace = await manager.findOne(Workspace, {
      where: { id: receipt.workspaceId },
      select: { id: true, currency: true },
    });
    receipt.parsedData = { ...parsed, currency: currencyCodeOrDefault(workspace?.currency) };
  }
}
