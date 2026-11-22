import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { assertFound } from '../../common/utils/assert-found.util';
import type { CreateContributionBody, CreateGoalBody, UpdateGoalBody } from '../../contracts';
import { Goal, GoalContribution } from '../../entities';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { toNumber } from './goal-money.util';
import { GoalProgressService } from './goal-progress.service';
import { GoalTransactionLinkService } from './goal-transaction-link.service';
import {
  contributionSnapshot,
  firstDayOfNextMonth,
  type GoalDetail,
  type GoalWithProgress,
  goalSnapshot,
  today,
  toProgress,
} from './goal-view.util';

export type { GoalCover, GoalDetail, GoalWithProgress } from './goal-view.util';

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(GoalContribution)
    private readonly contributionRepository: Repository<GoalContribution>,
    private readonly auditService: AuditService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
    private readonly linkService: GoalTransactionLinkService,
    private readonly progressService: GoalProgressService,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateGoalBody,
    selfMemberId: string | null = null,
  ): Promise<GoalWithProgress> {
    if (dto.walletId) {
      await this.progressService.assertCanFollow(workspaceId, dto.walletId, selfMemberId);
    }
    const goal = this.goalRepository.create({
      workspaceId,
      createdById: userId,
      name: dto.name,
      targetAmount: dto.targetAmount,
      currency: await this.workspaceCurrency.resolveFor(workspaceId, dto.currency),
      targetDate: dto.targetDate ?? null,
      walletId: dto.walletId ?? null,
    });

    const saved = await this.goalRepository.save(goal);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: saved.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: goalSnapshot(saved) },
    });
    return this.withProgress(saved, workspaceId);
  }

  async findAll(workspaceId: string, month?: string): Promise<GoalWithProgress[]> {
    const all = await this.goalRepository.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
    // A month narrows the list to the goals that actually moved in it.
    const end = month ? firstDayOfNextMonth(month) : undefined;
    const monthly = month
      ? await this.progressService.movedBetween(workspaceId, all, `${month}-01`, end as string)
      : null;
    const goals = monthly ? all.filter(goal => monthly.has(goal.id)) : all;

    if (goals.length === 0) {
      return [];
    }

    // A month's list shows each goal as it stood when that month ended, not as it is today.
    const progress = await this.progressService.progress(workspaceId, goals, end);

    return goals.map(goal => {
      const view = toProgress(goal, progress.get(goal.id));
      // The whole-list shape stays exactly as it was; only a month-scoped
      // request grows the extra field.
      return monthly ? { ...view, contributedInMonth: monthly.get(goal.id) ?? 0 } : view;
    });
  }

  async findOne(id: string, workspaceId: string): Promise<GoalDetail> {
    const goal = await this.goalRepository.findOne({ where: { id, workspaceId } });
    assertFound(goal, 'Goal');

    const contributions = await this.contributionRepository.find({
      where: { goalId: goal.id, workspaceId },
      order: { contributionDate: 'DESC', createdAt: 'DESC' },
    });

    const [progress, linked] = await Promise.all([
      this.progressService.progress(workspaceId, [goal]),
      this.linkService.describe(workspaceId, contributions),
    ]);

    return {
      // A goal following an account lists its contributions but does not count them.
      ...toProgress(goal, progress.get(goal.id)),
      contributions: contributions.map(contribution => ({
        id: contribution.id,
        amount: toNumber(contribution.amount),
        contributionDate: contribution.contributionDate,
        note: contribution.note,
        createdAt: contribution.createdAt,
        transaction: linked.get(contribution.transactionId ?? '') ?? null,
      })),
    };
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    dto: UpdateGoalBody,
    selfMemberId: string | null = null,
  ): Promise<GoalWithProgress> {
    const goal = await this.goalRepository.findOne({ where: { id, workspaceId } });
    assertFound(goal, 'Goal');
    const before = goalSnapshot(goal);

    // Checked only when it changes: someone else editing the name of a goal that
    // follows its owner's own account must not be refused for the account.
    if (dto.walletId !== undefined && dto.walletId !== goal.walletId) {
      if (dto.walletId) {
        await this.progressService.assertCanFollow(workspaceId, dto.walletId, selfMemberId);
      }
      goal.walletId = dto.walletId;
    }

    if (dto.name != null) {
      goal.name = dto.name;
    }
    if (dto.targetAmount != null) {
      goal.targetAmount = dto.targetAmount;
    }
    if (dto.currency != null) {
      goal.currency = dto.currency;
    }
    if (dto.targetDate !== undefined) {
      goal.targetDate = dto.targetDate;
    }

    await this.goalRepository.save(goal);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: goal.id,
      action: AuditAction.UPDATE,
      diff: { before, after: goalSnapshot(goal) },
      meta: { name: goal.name },
    });
    return this.withProgress(goal, workspaceId);
  }

  /**
   * Soft delete: the contribution history is a record of real money set
   * aside, so removing a goal hides it rather than erasing what happened.
   */
  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const goal = await this.goalRepository.findOne({ where: { id, workspaceId } });
    assertFound(goal, 'Goal');
    const before = goalSnapshot(goal);
    await this.goalRepository.softRemove(goal);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: id,
      action: AuditAction.DELETE,
      diff: { before, after: null },
      meta: { softDeleted: true },
    });
  }

  async addContribution(
    id: string,
    workspaceId: string,
    userId: string,
    dto: CreateContributionBody,
  ): Promise<GoalDetail> {
    const goal = await this.goalRepository.findOne({ where: { id, workspaceId } });
    assertFound(goal, 'Goal');
    await this.progressService.assertCountsContributions(workspaceId, goal);

    const contribution = this.contributionRepository.create({
      goalId: goal.id,
      workspaceId,
      createdById: userId,
      amount: dto.amount,
      contributionDate: dto.contributionDate ?? today(),
      note: dto.note ?? null,
    });
    const saved = await this.contributionRepository.save(contribution);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: goal.id,
      action: AuditAction.UPDATE,
      description: `Added contribution of ${toNumber(saved.amount)} ${goal.currency} to goal "${goal.name}"`,
      meta: { contribution: contributionSnapshot(saved), change: 'contribution_added' },
    });

    return this.findOne(goal.id, workspaceId);
  }

  async removeContribution(
    id: string,
    contributionId: string,
    workspaceId: string,
    userId: string,
  ): Promise<GoalDetail> {
    const contribution = await this.contributionRepository.findOne({
      where: { id: contributionId, goalId: id, workspaceId },
    });
    assertFound(contribution, 'Contribution');
    const removed = contributionSnapshot(contribution);

    await this.contributionRepository.remove(contribution);
    const detail = await this.findOne(id, workspaceId);
    await this.audit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.GOAL,
      entityId: id,
      action: AuditAction.UPDATE,
      description: `Removed contribution of ${removed.amount} ${detail.currency} from goal "${detail.name}"`,
      meta: { contribution: removed, change: 'contribution_removed' },
    });
    return detail;
  }

  /** The audit trail is a side record: failing to write it must not fail the goal change. */
  private async audit(event: CreateAuditEventDto): Promise<void> {
    try {
      await this.auditService.createEvent(event);
    } catch (error) {
      this.logger.warn(
        `Failed to record audit event ${event.action} for goal ${event.entityId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async withProgress(goal: Goal, workspaceId: string): Promise<GoalWithProgress> {
    const progress = await this.progressService.progress(workspaceId, [goal]);
    return toProgress(goal, progress.get(goal.id));
  }
}
