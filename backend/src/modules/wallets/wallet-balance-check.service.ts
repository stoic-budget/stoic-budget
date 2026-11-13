import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { payeeKeyOf } from '../../common/utils/payee-key.util';
import type {
  BalanceAdjustmentResult,
  BalanceCheckBody,
  BalanceCheckReason,
  BalanceCheckResult,
} from '../../contracts';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { Statement } from '../../entities/statement.entity';
import {
  Transaction,
  TransactionType,
  TransferPairKind,
  TransferPairSource,
} from '../../entities/transaction.entity';
import type { User } from '../../entities/user.entity';
import { Wallet } from '../../entities/wallet.entity';
import { AuditService } from '../audit/audit.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { balanceAdjustmentPayee } from './balance-adjustment-translations';
import {
  rowsJustAfter,
  statementCoverage,
  unconvertedUpTo,
  uncountedUpTo,
} from './balance-check-queries';
import {
  addDays,
  balanceAtEndOf,
  bookedLater,
  CENT,
  round2,
  statementGaps,
} from './balance-check-reasons';
import { walletLedgers } from './wallet-ledger';

/**
 * "Check balance": the one number the bank shows against ours at the end of
 * a day. A match is remembered on the account; a difference comes with the
 * likely reasons, and can be booked as one adjustment row that moves the
 * balance and net worth but never spending, income, budgets or reports.
 */
@Injectable()
export class WalletBalanceCheckService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly exchangeRates: ExchangeRatesService,
    private readonly auditService: AuditService,
  ) {}

  /** Read-only: nothing is saved, whatever the answer. */
  async check(
    id: string,
    workspaceId: string,
    body: BalanceCheckBody,
    viewerMemberId: string | null,
  ): Promise<BalanceCheckResult> {
    assertNotFuture(body.date);
    const wallet = await this.findWallet(this.walletRepository, id, workspaceId);
    return this.compare(wallet, workspaceId, body, viewerMemberId);
  }

  /** Remembers a check that matches; one that does not is refused, never saved. */
  async confirm(
    id: string,
    workspaceId: string,
    body: BalanceCheckBody,
    viewerMemberId: string | null,
  ): Promise<BalanceCheckResult> {
    const result = await this.check(id, workspaceId, body, viewerMemberId);
    if (!result.matches) {
      throw new ConflictException(appError('BALANCE_CHECK_MISMATCH'));
    }
    await this.remember(this.walletRepository, id, workspaceId, body);
    return result;
  }

  /**
   * Books the difference as it stands now, worked out here and never taken
   * from the client. Under a lock per account and recomputed inside it, so a
   * second click finds nothing left to book.
   */
  async bookAdjustment(
    id: string,
    workspaceId: string,
    body: BalanceCheckBody,
    user: Pick<User, 'id' | 'locale'>,
    viewerMemberId: string | null,
  ): Promise<BalanceAdjustmentResult> {
    assertNotFuture(body.date);
    const booked = await this.transactionRepository.manager.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `balance-adjustment:${workspaceId}:${id}`,
      ]);
      const wallets = manager.getRepository(Wallet);
      const transactions = manager.getRepository(Transaction);
      const wallet = await this.findWallet(wallets, id, workspaceId);
      // A row with no rate is not in our balance yet; booking now would count it twice later.
      const scope = { workspaceId, wallet, date: body.date };
      const missing = await unconvertedUpTo(transactions, this.exchangeRates, scope);
      if (missing.length > 0) {
        throw new ConflictException(
          appError('BALANCE_CHECK_UNCONVERTED', { currencies: missing.join(', ') }),
        );
      }
      // Rows still in Review or set aside as duplicates count once settled: same double count.
      const [inReview, duplicates] = await Promise.all([
        uncountedUpTo(transactions, this.exchangeRates, scope, 'in_review'),
        uncountedUpTo(transactions, this.exchangeRates, scope, 'duplicates'),
      ]);
      if (inReview.count + duplicates.count > 0) {
        throw new ConflictException(
          appError('BALANCE_CHECK_PENDING_REVIEW', { count: inReview.count + duplicates.count }),
        );
      }
      const ours = await this.ourBalance(transactions, wallet, workspaceId, body.date);
      const difference = round2(round2(body.balance) - ours);
      await this.remember(wallets, id, workspaceId, body);
      if (Math.abs(difference) < CENT) {
        return null;
      }
      const rowId = randomUUID();
      const amount = Math.abs(difference);
      const income = difference > 0;
      const payee = balanceAdjustmentPayee(user.locale);
      // The payee subscriber skips an adjustment, and the database keeps it
      // free of category and tax, on this path and on a restore alike.
      return transactions.save(
        transactions.create({
          id: rowId,
          workspaceId,
          statementId: null,
          walletId: wallet.id,
          ownerMemberId: wallet.ownerMemberId,
          // The day as typed: a Date would be formatted in the server's time zone.
          transactionDate: body.date as unknown as Date,
          counterpartyName: payee,
          paymentPurpose: payee,
          // Its key without a payee, so a later edit of the row does not mint one either.
          payeeKey: payeeKeyOf({ counterpartyName: payee, paymentPurpose: payee }),
          amount,
          debit: income ? null : amount,
          credit: income ? amount : null,
          currency: wallet.currency,
          transactionType: income ? TransactionType.INCOME : TransactionType.EXPENSE,
          categoryId: null,
          // A one-leg pair, as an investment contribution is: every spending
          // and income figure leaves out a paired row, every balance keeps it.
          transferPairId: rowId,
          transferPairSource: TransferPairSource.MANUAL,
          transferPairKind: TransferPairKind.ADJUSTMENT,
          // The person asked for it; nothing to confirm in Review.
          isVerified: true,
        }),
      );
    });

    if (booked) {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: user.id,
        entityType: EntityType.TRANSACTION,
        entityId: booked.id,
        action: AuditAction.CREATE,
        diff: { before: null, after: booked },
        meta: { source: 'balance-adjustment', walletId: id, date: body.date },
        severity: Severity.INFO,
        isUndoable: true,
      });
    }
    const wallet = await this.findWallet(this.walletRepository, id, workspaceId);
    return {
      check: await this.compare(wallet, workspaceId, body, viewerMemberId),
      transactionId: booked?.id ?? null,
    };
  }

  private async compare(
    wallet: Wallet,
    workspaceId: string,
    body: BalanceCheckBody,
    viewerMemberId: string | null,
  ): Promise<BalanceCheckResult> {
    const bankBalance = round2(body.balance);
    const ourBalance = await this.ourBalance(
      this.transactionRepository,
      wallet,
      workspaceId,
      body.date,
    );
    const difference = round2(bankBalance - ourBalance);
    const matches = Math.abs(difference) < CENT;
    return {
      date: body.date,
      bankBalance,
      ourBalance,
      difference,
      matches,
      reasons: matches
        ? []
        : await this.reasons(wallet, workspaceId, body.date, difference, viewerMemberId),
    };
  }

  /** Our balance at the end of the day: opening plus every counted row up to it. */
  private async ourBalance(
    transactions: Repository<Transaction>,
    wallet: Wallet,
    workspaceId: string,
    date: string,
  ): Promise<number> {
    const ledgers = await walletLedgers(transactions, this.exchangeRates, workspaceId, [wallet]);
    return balanceAtEndOf(
      Number(wallet.initialBalance) || 0,
      ledgers.get(wallet.id)?.days ?? [],
      date,
    );
  }

  private async reasons(
    wallet: Wallet,
    workspaceId: string,
    date: string,
    difference: number,
    viewerMemberId: string | null,
  ): Promise<BalanceCheckReason[]> {
    const scope = { workspaceId, wallet, date };
    const [unconverted, inReview, duplicates, later, coverage] = await Promise.all([
      unconvertedUpTo(this.transactionRepository, this.exchangeRates, scope),
      uncountedUpTo(this.transactionRepository, this.exchangeRates, scope, 'in_review'),
      uncountedUpTo(this.transactionRepository, this.exchangeRates, scope, 'duplicates'),
      rowsJustAfter(this.transactionRepository, this.exchangeRates, scope, viewerMemberId),
      statementCoverage(this.statementRepository, this.transactionRepository, scope),
    ]);
    const reasons: BalanceCheckReason[] = [];
    if (unconverted.length > 0) {
      reasons.push({ kind: 'unconverted', currencies: unconverted });
    }
    if (inReview.count > 0) {
      reasons.push({ kind: 'in_review', ...inReview });
    }
    if (duplicates.count > 0) {
      reasons.push({ kind: 'duplicates', ...duplicates });
    }
    const early = bookedLater(later, difference);
    if (early) {
      reasons.push({ kind: 'booked_later', amount: difference, rows: early });
    }
    for (const gap of statementGaps(coverage.spans, date, coverage.rowsAfterCoverage)) {
      reasons.push({ kind: 'statement_gap', ...gap });
    }
    return reasons;
  }

  private async findWallet(
    wallets: Repository<Wallet>,
    id: string,
    workspaceId: string,
  ): Promise<Wallet> {
    const wallet = await wallets.findOne({ where: { id, workspaceId } });
    if (!wallet) {
      throw new NotFoundException(appError('WALLET_NOT_FOUND'));
    }
    return wallet;
  }

  /** Keeps the newest check: an older day checked later does not replace it. */
  private async remember(
    wallets: Repository<Wallet>,
    id: string,
    workspaceId: string,
    body: BalanceCheckBody,
  ): Promise<void> {
    await wallets
      .createQueryBuilder()
      .update(Wallet)
      .set({ balanceCheckedAt: body.date, balanceCheckedAmount: round2(body.balance).toFixed(2) })
      .where('id = :id AND workspace_id = :workspaceId', { id, workspaceId })
      .andWhere('(balance_checked_at IS NULL OR balance_checked_at <= :date)', { date: body.date })
      .execute();
  }
}

/** The bank cannot show tomorrow's balance; a day of slack for time zones ahead of UTC. */
function assertNotFuture(date: string): void {
  if (date > addDays(new Date().toISOString().slice(0, 10), 1)) {
    throw new BadRequestException(appError('BALANCE_CHECK_FUTURE_DATE'));
  }
}
