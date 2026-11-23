import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, type Repository } from 'typeorm';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { InsightSeverity } from '../../entities/insight.entity';
import { ReportType, TelegramReport } from '../../entities/telegram-report.entity';
import { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { InsightsService } from '../insights/insights.service';
import { deliveredAfterPeriod } from './report-period';
import { TelegramService } from './telegram.service';

@Injectable()
export class TelegramScheduler {
  private readonly logger = new Logger(TelegramScheduler.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly insightsService: InsightsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
    @InjectRepository(TelegramReport)
    private readonly reportRepository: Repository<TelegramReport>,
  ) {}

  /** Sent once per period: a restart or a second instance does not send it twice. */
  private async delivered(userId: string, reportType: ReportType, date: string): Promise<boolean> {
    const report = await this.reportRepository.findOne({
      where: { userId, reportType, reportDate: date as never },
      select: { status: true, sentAt: true },
    });
    return deliveredAfterPeriod(report, reportType, date);
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyReports(): Promise<void> {
    // The day that ended: at 8 in the morning today has barely begun.
    const date = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    const users = await this.loadUsersWithTelegram();

    for (const user of users) {
      try {
        const workspaceId = await this.telegramService.resolveWorkspaceId(user);
        if (!workspaceId) {
          continue;
        }
        if (await this.delivered(user.id, ReportType.DAILY, date)) {
          continue;
        }
        await this.telegramService.sendReport(
          user,
          {
            reportType: ReportType.DAILY,
            chatId: user.telegramChatId || undefined,
            date,
          },
          workspaceId,
        );
        try {
          // Audit: record scheduled report exports via Telegram.
          await this.auditService.createEvent({
            workspaceId,
            actorType: ActorType.SYSTEM,
            actorId: null,
            actorLabel: 'Telegram Scheduler',
            entityType: EntityType.WORKSPACE,
            entityId: workspaceId,
            action: AuditAction.EXPORT,
            meta: {
              channel: 'telegram',
              reportType: ReportType.DAILY,
              date,
              userId: user.id,
            },
          });
        } catch (error) {
          this.logger.warn(
            `Audit event failed for Telegram daily report: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to send daily report for user ${user.id}: ${message}`);
      }
    }
  }

  @Cron('0 9 1 * *')
  async sendMonthlyReports(): Promise<void> {
    // The month that ended: on the 1st the new one has nothing in it yet.
    const now = new Date();
    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = previous.getUTCFullYear();
    const month = previous.getUTCMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

    const users = await this.loadUsersWithTelegram();

    for (const user of users) {
      try {
        const workspaceId = await this.telegramService.resolveWorkspaceId(user);
        if (!workspaceId) {
          continue;
        }
        if (await this.delivered(user.id, ReportType.MONTHLY, monthStart)) {
          continue;
        }
        await this.telegramService.sendReport(
          user,
          {
            reportType: ReportType.MONTHLY,
            chatId: user.telegramChatId || undefined,
            year,
            month,
          },
          workspaceId,
        );
        try {
          // Audit: record scheduled monthly report exports via Telegram.
          await this.auditService.createEvent({
            workspaceId,
            actorType: ActorType.SYSTEM,
            actorId: null,
            actorLabel: 'Telegram Scheduler',
            entityType: EntityType.WORKSPACE,
            entityId: workspaceId,
            action: AuditAction.EXPORT,
            meta: {
              channel: 'telegram',
              reportType: ReportType.MONTHLY,
              year,
              month,
              userId: user.id,
            },
          });
        } catch (error) {
          this.logger.warn(
            `Audit event failed for Telegram monthly report: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to send monthly report for user ${user.id}: ${message}`);
      }
    }
  }

  /**
   * Refreshes each connected user's insights and pushes only the ones that
   * are newly created and urgent (warn/critical) — the same 80/20-style
   * warnings and category/savings-rate signals the Advice/Alerts pages show,
   * now reaching a channel the user doesn't have to remember to open.
   *
   * Runs after the daily report so a user who has both connected gets one
   * digest of updates per morning rather than a message the moment each
   * signal happens to compute.
   */
  @Cron('15 8 * * *')
  async pushInsightDigests(): Promise<void> {
    const users = await this.loadUsersWithTelegram();

    for (const user of users) {
      try {
        const workspaceId = await this.telegramService.resolveWorkspaceId(user);
        if (!workspaceId) {
          continue;
        }
        const { newInsights } = await this.insightsService.refresh(user.id, workspaceId);
        const urgent = newInsights.filter(
          insight =>
            insight.severity === InsightSeverity.WARN ||
            insight.severity === InsightSeverity.CRITICAL,
        );

        if (urgent.length > 0) {
          await this.telegramService.pushInsightDigest(user, urgent);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to push insight digest for user ${user.id}: ${message}`);
      }
    }
  }

  private async loadUsersWithTelegram(): Promise<User[]> {
    return this.userRepository.find({
      where: {
        telegramChatId: Not(IsNull()),
        isActive: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
