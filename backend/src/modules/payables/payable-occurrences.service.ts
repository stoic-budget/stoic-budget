import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { formatDay, toDay } from '../../common/recurrence/date-only';
import type { PayableOccurrenceBody } from '../../contracts';
import { Payable, PayableStatus } from '../../entities/payable.entity';
import { PayableMatchRejection } from '../../entities/payable-match-rejection.entity';
import { Transaction } from '../../entities/transaction.entity';
import { PayableRecurrenceService } from './payable-recurrence.service';

/**
 * What one occurrence of a repeating bill can do without touching the series
 * (skip it, move it, change its amount), and "not this payment" for any bill.
 */
@Injectable()
export class PayableOccurrencesService {
  constructor(
    @InjectRepository(Payable)
    private readonly payableRepository: Repository<Payable>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly recurrence: PayableRecurrenceService,
  ) {}

  /**
   * Skip: not owed, the series goes on (the next occurrence is made now).
   * Move: due another day; the series keeps the day its rule gave it.
   * Amount: this occurrence only; the next one is made with the series amount.
   * A bill with money against it is past all three.
   */
  async apply(id: string, workspaceId: string, body: PayableOccurrenceBody): Promise<Payable> {
    const payable = await this.load(id, workspaceId);
    if (!payable.seriesId) throw new BadRequestException(appError('PAYABLE_NOT_RECURRING'));
    if (payable.skippedAt && body.action === 'skip') return this.asStored(payable);
    if (
      payable.status === PayableStatus.PAID ||
      payable.status === PayableStatus.ARCHIVED ||
      Number(payable.paidAmount) > 0
    ) {
      throw new ConflictException(appError('PAYABLE_OCCURRENCE_SETTLED'));
    }
    const today = formatDay(new Date());
    switch (body.action) {
      case 'skip':
        payable.status = PayableStatus.ARCHIVED;
        payable.skippedAt = new Date();
        break;
      case 'move': {
        if (!body.dueDate) throw new BadRequestException(appError('REQUEST_INVALID'));
        payable.dueDate = body.dueDate as unknown as Date;
        // A new day earns a new reminder.
        payable.dueSoonNotifiedAt = null;
        if (payable.status !== PayableStatus.SCHEDULED) {
          payable.status = body.dueDate < today ? PayableStatus.OVERDUE : PayableStatus.TO_PAY;
        }
        break;
      }
      case 'amount':
        if (body.amount == null) throw new BadRequestException(appError('REQUEST_INVALID'));
        payable.baseAmount ??= String(payable.amount);
        payable.amount = body.amount;
        break;
    }
    const saved = this.asStored(await this.payableRepository.save(payable));
    if (body.action === 'skip') await this.recurrence.ensureSeriesOf(saved);
    return saved;
  }

  /**
   * "Not this payment": this bank row is never proposed or linked to this
   * bill again. Linked already (by hand or by the automatic match of a payment
   * marked without its money), the payment stays and goes back to waiting for
   * its bank row; the row itself is left alone.
   */
  async reject(
    id: string,
    workspaceId: string,
    userId: string,
    transactionId: string,
  ): Promise<Payable> {
    await this.load(id, workspaceId);
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
      select: { id: true },
    });
    if (!transaction) throw new NotFoundException(appError('PAYABLE_TRANSACTION_NOT_FOUND'));
    await this.payableRepository.manager.transaction(async manager => {
      await manager
        .createQueryBuilder()
        .insert()
        .into(PayableMatchRejection)
        .values({ workspaceId, payableId: id, transactionId, createdById: userId })
        .orIgnore()
        .execute();
      await manager.query(
        `UPDATE "payable_payments" SET "transaction_id" = NULL
          WHERE "payable_id" = $1 AND "workspace_id" = $2 AND "transaction_id" = $3`,
        [id, workspaceId, transactionId],
      );
      await manager.query(
        `UPDATE "payables" SET "linked_transaction_id" = NULL
          WHERE "id" = $1 AND "workspace_id" = $2 AND "linked_transaction_id" = $3`,
        [id, workspaceId, transactionId],
      );
    });
    return this.load(id, workspaceId);
  }

  private async load(id: string, workspaceId: string): Promise<Payable> {
    const payable = await this.payableRepository.findOne({
      where: { id, workspaceId },
      relations: { tags: true },
    });
    if (!payable) throw new NotFoundException(appError('PAYABLE_NOT_FOUND'));
    return payable;
  }

  /** As a read returns it: decimals as strings, the due day as YYYY-MM-DD. */
  private asStored(payable: Payable): Payable {
    const decimal = (value: number | string) => Number(value).toFixed(2);
    payable.amount = decimal(payable.amount) as unknown as number;
    payable.paidAmount = decimal(payable.paidAmount ?? 0) as unknown as number;
    payable.baseAmount = payable.baseAmount == null ? null : decimal(payable.baseAmount);
    payable.dueDate = (payable.dueDate ? toDay(payable.dueDate) : null) as unknown as Date | null;
    return payable;
  }
}
