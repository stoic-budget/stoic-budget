import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InsightCategory, InsightSeverity } from '../../../entities/insight.entity';
import { computeMonthRange } from '../../budgets/budget-period.util';
import { StoicLedgerService } from '../../budgets/stoic/stoic-ledger.service';
import { RuleHealthService } from '../../classification/services/rule-health.service';
import { ForecastService } from '../../forecast/forecast.service';
import { GoalPlanService } from '../../goals/goal-plan.service';
import { GoalsService } from '../../goals/goals.service';
import { collectReflectionSignals } from '../stoic/reflection-signals';
import { StoicBehaviorService } from '../stoic/stoic-behavior.service';
import {
  collectSignals,
  JUDGE_CURRENT_FROM_DAY,
  SERIOUS_PRIORITY,
  type StoicGoalView,
  type StoicOutlook,
  type StoicSignal,
} from '../stoic/stoic-signals';
import { STOIC_VARIANT_COUNT } from '../stoic-texts/types';
import type { AnalysisContext, InsightAnalyzer, InsightCandidate } from './analyzer.interface';

/** More than this and the page stops being advice and becomes a report. */
const MAX_STOIC_CARDS = 5;
/** Reflections on the quarter stand beside the month's reading; they do not bury it. */
const MAX_REFLECTION_CARDS = 2;
/** Goals checked for pace, and goals with no date; each one is a plan computation. */
const MAX_DATED_GOALS = 5;
const MAX_UNDATED_GOALS = 3;
/** A goal just set has had no time to move: its lack of pace says nothing yet. */
const UNDATED_GOAL_MIN_AGE_MS = 30 * 86_400_000;
/** How far ahead the forecast is read for a balance below zero. */
const OUTLOOK_HORIZON_DAYS = 45;

/** A small stable hash for the rotation below. */
function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value;
}

/** Each workspace has its own rotation of wordings, moving on month by month. */
const rotation = (workspaceId: string, month: Date) =>
  hash(workspaceId) + month.getFullYear() * 12 + month.getMonth();

/**
 * Advice in the Stoic sense. Budgets say what the user meant to spend on
 * necessity, work, virtue and leisure; transactions, goals and upcoming
 * payments say what is actually happening. The signals (stoic-signals.ts)
 * name every gap, habit and good month the data supports; this class decides
 * which of them to say, and in which of five wordings.
 *
 * All candidates are INFO: this is reflection for the Advice page, not an
 * alarm for the banner.
 */
@Injectable()
export class StoicAnalyzer implements InsightAnalyzer {
  private readonly logger = new Logger(StoicAnalyzer.name);

  constructor(
    private readonly stoicLedgerService: StoicLedgerService,
    private readonly stoicBehaviorService: StoicBehaviorService,
    private readonly goalsService: GoalsService,
    private readonly goalPlanService: GoalPlanService,
    // Looked up when needed: ForecastModule reaches this module back through
    // Subscriptions → Notifications → Telegram, so it cannot be imported here.
    private readonly moduleRef: ModuleRef,
    private readonly ruleHealthService: RuleHealthService,
  ) {}

  async analyze(context: AnalysisContext, now = new Date()): Promise<InsightCandidate[]> {
    const workspaceId = context.workspaceId;
    if (!workspaceId) {
      return [];
    }

    const balance = await this.stoicLedgerService.monthlyBalance(workspaceId, 6, now);
    const judgesPreviousMonth = now.getDate() < JUDGE_CURRENT_FROM_DAY;
    const referenceStart = new Date(
      now.getFullYear(),
      now.getMonth() - (judgesPreviousMonth ? 1 : 0),
      1,
    );

    // Each source is optional: a failing goal plan must not silence the budgets.
    const [behavior, goals, outlook, rules] = await Promise.all([
      this.optional('behavior', () =>
        this.stoicBehaviorService.load(workspaceId, balance.currency, referenceStart),
      ),
      this.optional('goals', () => this.loadGoals(workspaceId, now)),
      this.optional('outlook', () => this.loadOutlook(workspaceId, balance.currency)),
      this.optional('rules', () =>
        this.ruleHealthService.load(
          workspaceId,
          context.userId,
          computeMonthRange(referenceStart),
          now,
        ),
      ),
    ]);

    const stoicContext = { now, balance, behavior, goals: goals ?? [], outlook, rules };
    const signals = collectSignals(stoicContext);
    // Praise for a month with rows still in Review would judge a month not yet read.
    const chosen = this.select(signals, rotation(workspaceId, referenceStart), {
      mayPraise: (behavior?.unconfirmedRows ?? 0) === 0,
    });
    // A card already names this merchant: a second one about it says nothing new.
    const named = new Set(chosen.map(signal => signal.params.merchant));
    const reflections = collectReflectionSignals(stoicContext)
      .filter(signal => !(signal.params.merchant && named.has(signal.params.merchant)))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MAX_REFLECTION_CARDS);
    const referenceMonth = balance.months[judgesPreviousMonth ? 1 : 0]?.month ?? 'none';
    const expiresAt = judgesPreviousMonth
      ? new Date(now.getFullYear(), now.getMonth(), JUDGE_CURRENT_FROM_DAY)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const toCandidate = (signal: StoicSignal): InsightCandidate => ({
      type: signal.type,
      category: InsightCategory.STOIC,
      severity: InsightSeverity.INFO,
      messageKey: signal.key,
      messageParams: {
        ...signal.params,
        currency: balance.currency,
        // The same situation reads differently from one month to the next,
        // and differently in two workspaces in the same month.
        variant: (rotation(workspaceId, referenceStart) + hash(signal.key)) % STOIC_VARIANT_COUNT,
      },
      deduplicationKey: [
        InsightCategory.STOIC,
        signal.praise ? 'praise' : signal.key.replace(/^stoic\./, ''),
        workspaceId,
        signal.subject ?? '',
        referenceMonth,
      ].join(':'),
      // Priority travels with the row so the daily quote can pick the
      // situation that matters most without recomputing anything.
      data: { month: referenceMonth, priority: signal.priority, ...signal.params, ...signal.data },
      expiresAt,
    });

    return [...chosen, ...reflections].map(toCandidate);
  }

  /**
   * The most important corrections first, capped. One praise is added when
   * nothing serious needs correcting — which one rotates month by month among
   * those the data supports, so a good streak is not praised the same way twice.
   */
  private select(
    signals: StoicSignal[],
    rotation: number,
    { mayPraise }: { mayPraise: boolean },
  ): StoicSignal[] {
    const corrections = signals
      .filter(signal => !signal.praise)
      .sort((a, b) => b.priority - a.priority);
    const praises = signals.filter(signal => signal.praise);
    const serious = corrections.some(signal => signal.priority >= SERIOUS_PRIORITY);

    const praise =
      mayPraise && !serious && praises.length > 0 ? [praises[rotation % praises.length]] : [];
    return [...praise, ...corrections].slice(0, MAX_STOIC_CARDS);
  }

  private async loadGoals(workspaceId: string, now: Date): Promise<StoicGoalView[]> {
    const open = (await this.goalsService.findAll(workspaceId)).filter(goal => !goal.isReached);
    return Promise.all(
      [
        ...open.filter(goal => goal.targetDate).slice(0, MAX_DATED_GOALS),
        ...open
          .filter(
            goal =>
              !goal.targetDate &&
              now.getTime() - new Date(goal.createdAt).getTime() >= UNDATED_GOAL_MIN_AGE_MS,
          )
          .slice(0, MAX_UNDATED_GOALS),
      ].map(async goal => {
        const plan = await this.goalPlanService.getPlan(goal.id, workspaceId, now);
        return {
          id: goal.id,
          name: goal.name,
          percent: goal.percent,
          status: plan.status,
          requiredPerMonth: plan.requiredPerMonth,
          pacePerMonth: plan.pace.perMonth,
          monthsLate: plan.forecast.monthsLate,
          freePerMonth: plan.capacity.free,
        };
      }),
    );
  }

  /** The Forecast page's own numbers, income included, so the two never disagree. */
  private async loadOutlook(workspaceId: string, currency: string): Promise<StoicOutlook> {
    const forecast = await this.moduleRef
      .get(ForecastService, { strict: false })
      .getForecast(workspaceId, { days: OUTLOOK_HORIZON_DAYS });
    return {
      shortfallDate: forecast.shortfallDate,
      lowestBalance: forecast.lowestBalance,
      reserve: await this.stoicBehaviorService.reserve(
        workspaceId,
        currency,
        forecast.openingBalance,
      ),
    };
  }

  private async optional<T>(source: string, load: () => Promise<T>): Promise<T | null> {
    try {
      return await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({ type: 'stoic_source_failed', source, message });
      return null;
    }
  }
}
