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
import { PayablePayment } from '../../entities/payable-payment.entity';
import { Transaction } from '../../entities/transaction.entity';
import { PayableRecurrenceService } from './payable-recurrence.service';
import { lockSeries } from './series-lock';

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
   * A bill with money against it is past all three. Stop: no occurrence is
   * made after this series' last one; the rule is cleared on every occurrence,
   * so neither the daily job nor a restored backup takes it up again.
   * The series lock comes first, then the bill is locked as a payment locks
   * it, so a payment arriving at the same time is either seen here or waits
   * for this to finish.
   */
  async apply(id: string, workspaceId: string, body: PayableOccurrenceBody): Promise<Payable> {
    if (
      (body.action === 'move' && !body.dueDate) ||
      (body.action === 'amount' && body.amount == null)
    ) {
      throw new BadRequestException(appError('REQUEST_INVALID'));
    }
    const payable = await this.payableRepository.manager.transaction(async manager => {
      const payables = manager.getRepository(Payable);
      // The series lock first, as every writer of a series takes it (see `lockSeries`).
      const series = await payables.findOne({
        where: { id, workspaceId },
        select: { id: true, seriesId: true },
      });
      if (series?.seriesId) await lockSeries(manager, workspaceId, series.seriesId);
      const locked = await payables.findOne({
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException(appError('PAYABLE_NOT_FOUND'));
      if (!locked.seriesId) throw new BadRequestException(appError('PAYABLE_NOT_RECURRING'));
      if (body.action === 'stop') {
        // A loan's bills stop with its reminders, in the loan terms.
        if (locked.loanWalletId) throw new BadRequestException(appError('PAYABLE_LOAN_MANAGED'));
        await this.recurrence.stopSeries(workspaceId, locked.seriesId, manager);
        return locked;
      }
      if (locked.skippedAt && body.action === 'skip') return locked;
      if (
        locked.status === PayableStatus.PAID ||
        locked.status === PayableStatus.ARCHIVED ||
        Number(locked.paidAmount) > 0
      ) {
        throw new ConflictException(appError('PAYABLE_OCCURRENCE_SETTLED'));
      }
      this.change(locked, body);
      return payables.save(locked);
    });
    if (body.action === 'skip') await this.recurrence.ensureSeriesOf(payable);
    return this.asStored(await this.load(id, workspaceId));
  }

  private change(payable: Payable, body: PayableOccurrenceBody): void {
    switch (body.action) {
      case 'skip':
        payable.status = PayableStatus.ARCHIVED;
        payable.skippedAt = new Date();
        break;
      case 'move': {
        const dueDate = body.dueDate as string;
        payable.dueDate = dueDate as unknown as Date;
        // A new day earns a new reminder.
        payable.dueSoonNotifiedAt = null;
        if (payable.status !== PayableStatus.SCHEDULED) {
          payable.status =
            dueDate < formatDay(new Date()) ? PayableStatus.OVERDUE : PayableStatus.TO_PAY;
        }
        break;
      }
      case 'amount':
        payable.baseAmount ??= String(payable.amount);
        payable.amount = body.amount as number;
        break;
    }
  }

  /**
   * "Not this payment": this bank row is never proposed or linked to this
   * bill again. Linked already (by hand or by the automatic match of a payment
   * marked without its money), the payment stays and goes back to waiting for
   * its bank row; the row itself is left alone. The transaction the bill
   * recorded for its own payment (cash, a wallet) is not a match and is refused:
   * unlinked, it would stay in the books while the payment waited for another.
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
    const own = await this.payableRepository.manager.getRepository(PayablePayment).exists({
      where: { payableId: id, workspaceId, transactionId, ownTransaction: true },
    });
    if (own) throw new ConflictException(appError('PAYABLE_REJECT_OWN_PAYMENT'));
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
