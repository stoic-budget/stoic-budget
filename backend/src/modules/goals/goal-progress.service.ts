import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { GoalAccount } from '../../contracts';
import { type Goal, GoalContribution } from '../../entities';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { walletLedgers } from '../wallets/wallet-ledger';
import { normalizeCurrency, round2, toNumber } from './goal-money.util';

export type ProgressGoal = Pick<Goal, 'id' | 'currency' | 'walletId'>;

export interface GoalProgress {
  /** What the goal has, in its own currency. */
  amount: number;
  account: GoalAccount | null;
  /**
   * When the figures begin, for a goal that follows an account: the account's
   * first day. Null for a goal counting contributions, whose own creation is
   * where its history starts.
   */
  since: Date | null;
}

/** A linked account with its daily movements and the rate into the goal's currency. */
interface Followed {
  wallet: Wallet;
  days: Array<{ date: string; net: number }>;
  rate: number | null;
}

/**
 * What a goal has put aside: the sum of its contributions, or — while it
 * follows an active account — that account's balance in the goal's currency.
 * Every read model of a goal (list, page, plan, flow) asks here, so they
 * cannot disagree about which of the two counts.
 *
 * Contributions of a following goal stay in the database untouched; they are
 * only left out of the sum, so stopping to follow brings them back.
 */
@Injectable()
export class GoalProgressService {
  constructor(
    @InjectRepository(GoalContribution)
    private readonly contributionRepository: Repository<GoalContribution>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  /** Each goal's progress, or as it stood before `before` (`YYYY-MM-DD`, exclusive). */
  async progress(
    workspaceId: string,
    goals: ProgressGoal[],
    before?: string,
  ): Promise<Map<string, GoalProgress>> {
    const { followed, archived } = await this.loadAccounts(workspaceId, goals);
    const counted = goals.filter(goal => !followed.has(goal.id));
    const totals = await this.sumContributions(workspaceId, counted, undefined, before);

    const result = new Map<string, GoalProgress>();
    for (const goal of goals) {
      const account = followed.get(goal.id);
      if (account) {
        const balance = balanceAt(account, before);
        result.set(goal.id, {
          // An overdrawn account has saved nothing toward the goal, not less than nothing.
          amount: account.rate === null ? 0 : round2(Math.max(balance * account.rate, 0)),
          account: view(account.wallet, balance, account.rate === null ? 'no_rate' : 'following'),
          since: firstDay(account),
        });
        continue;
      }
      const shelved = archived.get(goal.id);
      result.set(goal.id, {
        amount: totals.get(goal.id) ?? 0,
        account: shelved ? view(shelved.wallet, balanceAt(shelved, before), 'archived') : null,
        since: null,
      });
    }
    return result;
  }

  /**
   * What each goal moved by in [`from`, `before`): its contributions, or the
   * change of the followed account's balance. A goal that did not move at all
   * is left out of the map, which makes the map a filter too.
   */
  async movedBetween(
    workspaceId: string,
    goals: ProgressGoal[],
    from: string,
    before: string,
  ): Promise<Map<string, number>> {
    const { followed } = await this.loadAccounts(workspaceId, goals);
    const counted = goals.filter(goal => !followed.has(goal.id));
    const moved = await this.sumContributions(workspaceId, counted, from, before);

    for (const [goalId, account] of followed) {
      const active = account.days.some(day => day.date >= from && day.date < before);
      // Without a rate the movement cannot be put in the goal's currency at all.
      if (!active || account.rate === null) {
        continue;
      }
      const change = balanceAt(account, before) - balanceAt(account, from);
      moved.set(goalId, round2(change * account.rate));
    }
    return moved;
  }

  /**
   * A goal may follow an active account of its own workspace that is shared or
   * belongs to the person linking it — never another member's own account.
   * The three refusals read alike, so the answer does not tell whether an id
   * of another workspace exists.
   */
  async assertCanFollow(
    workspaceId: string,
    walletId: string,
    selfMemberId: string | null,
  ): Promise<void> {
    const wallet = await this.walletRepository.findOne({ where: { id: walletId, workspaceId } });
    const othersOwn = wallet?.ownerMemberId != null && wallet.ownerMemberId !== selfMemberId;
    if (!wallet?.isActive || othersOwn) {
      throw new BadRequestException(appError('GOAL_ACCOUNT_UNAVAILABLE'));
    }
  }

  /** Refuses a hand-made or transaction movement on a goal whose progress is an account's balance. */
  async assertCountsContributions(workspaceId: string, goal: ProgressGoal): Promise<void> {
    if (!goal.walletId) {
      return;
    }
    const following = await this.walletRepository.exists({
      where: { id: goal.walletId, workspaceId, isActive: true },
    });
    if (following) {
      throw new ConflictException(appError('GOAL_FOLLOWS_ACCOUNT'));
    }
  }

  private async loadAccounts(
    workspaceId: string,
    goals: ProgressGoal[],
  ): Promise<{ followed: Map<string, Followed>; archived: Map<string, Followed> }> {
    const followed = new Map<string, Followed>();
    // An archived account is shown by name and balance, but the goal counts contributions.
    const archived = new Map<string, Followed>();
    const walletIds = [...new Set(goals.flatMap(goal => goal.walletId ?? []))];
    if (walletIds.length === 0) {
      return { followed, archived };
    }
    const wallets = await this.walletRepository.find({
      where: { id: In(walletIds), workspaceId },
    });
    const ledgers = await walletLedgers(
      this.transactionRepository,
      this.exchangeRates,
      workspaceId,
      wallets,
    );
    const rates = new Map<string, number | null>();

    for (const goal of goals) {
      const wallet = wallets.find(row => row.id === goal.walletId);
      if (!wallet) {
        continue;
      }
      const days = ledgers.get(wallet.id)?.days ?? [];
      if (!wallet.isActive) {
        archived.set(goal.id, { wallet, days, rate: null });
        continue;
      }
      followed.set(goal.id, {
        wallet,
        days,
        rate: await this.rate(rates, wallet.currency, goal.currency, workspaceId),
      });
    }
    return { followed, archived };
  }

  /** Today's rate, looked up once per pair. Null when there is none: never 1:1. */
  private async rate(
    cache: Map<string, number | null>,
    from: string,
    to: string,
    workspaceId: string,
  ): Promise<number | null> {
    const source = normalizeCurrency(from);
    const target = normalizeCurrency(to);
    if (source === target) {
      return 1;
    }
    const key = `${source}:${target}`;
    if (!cache.has(key)) {
      const rate = await this.exchangeRates
        .getRateOrNull(source, target, undefined, workspaceId)
        .catch(() => null);
      cache.set(key, rate);
    }
    return cache.get(key) ?? null;
  }

  /** Contributions per goal, optionally inside [`from`, `before`), in one query. */
  private async sumContributions(
    workspaceId: string,
    goals: ProgressGoal[],
    from?: string,
    before?: string,
  ): Promise<Map<string, number>> {
    if (goals.length === 0) {
      return new Map();
    }
    const query = this.contributionRepository
      .createQueryBuilder('contribution')
      .select('contribution.goal_id', 'goalId')
      .addSelect('COALESCE(SUM(contribution.amount), 0)', 'total')
      .where('contribution.workspace_id = :workspaceId', { workspaceId })
      .andWhere('contribution.goal_id IN (:...goalIds)', { goalIds: goals.map(goal => goal.id) });
    if (from) {
      query.andWhere('contribution.contribution_date >= :from', { from });
    }
    if (before) {
      query.andWhere('contribution.contribution_date < :before', { before });
    }
    const rows = await query
      .groupBy('contribution.goal_id')
      .getRawMany<{ goalId: string; total: string }>();
    return new Map(rows.map(row => [row.goalId, toNumber(row.total)]));
  }
}

/** The account's balance in its own currency, as it stood before `before` (exclusive), or today. */
function balanceAt(account: Followed, before?: string): number {
  const moved = account.days
    .filter(day => !before || day.date < before)
    .reduce((sum, day) => sum + day.net, 0);
  return (Number(account.wallet.initialBalance) || 0) + moved;
}

function firstDay(account: Followed): Date {
  const created = new Date(account.wallet.createdAt);
  const first = account.days[0] ? new Date(account.days[0].date) : null;
  return first && first < created ? first : created;
}

function view(wallet: Wallet, balance: number, status: GoalAccount['status']): GoalAccount {
  return {
    id: wallet.id,
    name: wallet.name,
    currency: wallet.currency,
    balance: round2(balance),
    status,
  };
}
