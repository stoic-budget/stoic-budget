import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { Subscription } from '../../entities/subscription.entity';
import { SubscriptionCharge } from '../../entities/subscription-charge.entity';
import { SubscriptionMatchRejection } from '../../entities/subscription-match-rejection.entity';
import { Transaction } from '../../entities/transaction.entity';
import { SubscriptionsService } from './subscriptions.service';

/**
 * "Not this payment": a bank row refused as a subscription's payment. A
 * payment already linked to it is removed the way a person removes one (the
 * payee rule goes with it when nothing else holds it); the row is then left
 * out of the rows offered for that subscription and out of the detected
 * charges booked when it is confirmed.
 */
@Injectable()
export class SubscriptionMatchRejectionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(SubscriptionCharge)
    private readonly chargeRepository: Repository<SubscriptionCharge>,
    @InjectRepository(SubscriptionMatchRejection)
    private readonly rejectionRepository: Repository<SubscriptionMatchRejection>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async reject(
    id: string,
    workspaceId: string,
    userId: string,
    transactionId: string,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.exists({ where: { id, workspaceId } });
    if (!subscription) throw new NotFoundException(appError('SUBSCRIPTION_NOT_FOUND'));
    const transaction = await this.transactionRepository.exists({
      where: { id: transactionId, workspaceId },
    });
    if (!transaction) {
      throw new NotFoundException(appError('SUBSCRIPTION_TRANSACTION_NOT_FOUND'));
    }
    const charge = await this.chargeRepository.findOne({
      where: { subscriptionId: id, transactionId, workspaceId },
      select: { id: true },
    });
    if (charge) {
      await this.subscriptionsService.removeCharge(id, charge.id, workspaceId, userId);
    }
    await this.rejectionRepository
      .createQueryBuilder()
      .insert()
      .values({ workspaceId, subscriptionId: id, transactionId, createdById: userId })
      .orIgnore()
      .execute();
  }
}
