import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type {
  CalendarFeedCreated,
  CalendarFeedIncludeBody,
  CalendarFeedSettings,
} from '../../contracts';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { CalendarFeed } from '../../entities/calendar-feed.entity';
import { AuditService } from '../audit/audit.service';
import { recordSecurityEvent } from '../auth/security-audit.util';

/** What a feed carries before its member changes anything. */
const DEFAULT_INCLUDE = { payables: true, subscriptions: true, taxDeadlines: true, invoices: true };

/** The stored form of a token: its SHA-256, hex. The token itself is never kept. */
export function hashFeedToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

type IncludeColumns = Partial<
  Pick<
    CalendarFeed,
    'includePayables' | 'includeSubscriptions' | 'includeTaxDeadlines' | 'includeInvoices'
  >
>;

function includeColumns(body: CalendarFeedIncludeBody): IncludeColumns {
  return {
    ...(body.payables === undefined ? {} : { includePayables: body.payables }),
    ...(body.subscriptions === undefined ? {} : { includeSubscriptions: body.subscriptions }),
    ...(body.taxDeadlines === undefined ? {} : { includeTaxDeadlines: body.taxDeadlines }),
    ...(body.invoices === undefined ? {} : { includeInvoices: body.invoices }),
  };
}

/**
 * A member's own calendar feed in a workspace: turned on (a new secret link),
 * a new link that revokes the old one, what it carries, turned off. Every
 * read and write is keyed by the workspace and the caller's own membership.
 */
@Injectable()
export class CalendarFeedService {
  private readonly logger = new Logger(CalendarFeedService.name);

  constructor(
    @InjectRepository(CalendarFeed)
    private readonly feedRepository: Repository<CalendarFeed>,
    private readonly auditService: AuditService,
  ) {}

  async get(workspaceId: string, memberId: string | null): Promise<CalendarFeedSettings> {
    const feed = await this.feedRepository.findOne({
      where: { workspaceId, memberId: this.requireMember(memberId) },
    });
    return this.toSettings(feed);
  }

  /**
   * Turns the feed on, or gives it a new link: a new token replaces the stored
   * hash, so the old link stops working at once. What it carries stays, except
   * the kinds the body names. Audited like an API key: who, which feed, never
   * the token or its hash.
   */
  async issue(
    workspaceId: string,
    memberId: string | null,
    userId: string,
    body: CalendarFeedIncludeBody,
  ): Promise<CalendarFeedCreated> {
    const member = this.requireMember(memberId);
    const token = randomBytes(24).toString('base64url');
    const tokenHash = hashFeedToken(token);
    const existing = await this.feedRepository.findOne({
      where: { workspaceId, memberId: member },
    });
    // Each write is conditional, so a request that lost a race never answers a
    // link the other one has already replaced: it is a 409 instead.
    if (existing) {
      const result = await this.feedRepository.update(
        { id: existing.id, workspaceId, tokenHash: existing.tokenHash },
        { tokenHash, lastFetchedAt: null, ...includeColumns(body) },
      );
      if (!result.affected) throw this.changedMeanwhile();
    } else {
      const result = await this.feedRepository
        .createQueryBuilder()
        .insert()
        .into(CalendarFeed)
        .values({ workspaceId, memberId: member, tokenHash, ...includeColumns(body) })
        .orIgnore()
        .returning('id')
        .execute();
      if (result.raw.length === 0) throw this.changedMeanwhile();
    }
    // Read back by this token: a request that renewed the link right after our
    // write has replaced it already, and answering it would hand out a dead link.
    const saved = await this.feedRepository.findOne({
      where: { workspaceId, memberId: member, tokenHash },
    });
    if (!saved) throw this.changedMeanwhile();
    await this.audit(saved, userId, existing ? AuditAction.UPDATE : AuditAction.CREATE);
    return { ...this.toSettings(saved), token };
  }

  async update(
    workspaceId: string,
    memberId: string | null,
    body: CalendarFeedIncludeBody,
  ): Promise<CalendarFeedSettings> {
    const member = this.requireMember(memberId);
    const feed = await this.feedRepository.findOne({ where: { workspaceId, memberId: member } });
    if (!feed) throw new NotFoundException(appError('CALENDAR_FEED_NOT_FOUND'));
    const changes = includeColumns(body);
    if (Object.keys(changes).length > 0) {
      await this.feedRepository.update({ id: feed.id, workspaceId }, changes);
    }
    return this.get(workspaceId, member);
  }

  /** Turns the feed off: the row goes, and with it the link. Idempotent. */
  async remove(
    workspaceId: string,
    memberId: string | null,
    userId: string,
  ): Promise<CalendarFeedSettings> {
    const feed = await this.feedRepository.findOne({
      where: { workspaceId, memberId: this.requireMember(memberId) },
    });
    if (feed) {
      const result = await this.feedRepository.delete({ id: feed.id, workspaceId });
      if (result.affected) await this.audit(feed, userId, AuditAction.DELETE);
    }
    return this.toSettings(null);
  }

  /** The feed behind a link, or null for an unknown or revoked token. */
  async findByToken(token: string): Promise<CalendarFeed | null> {
    return this.feedRepository.findOne({ where: { tokenHash: hashFeedToken(token) } });
  }

  /** A calendar app read the feed; raw SQL so `updated_at` keeps meaning "settings changed". */
  async markFetched(feed: CalendarFeed): Promise<void> {
    await this.feedRepository.query(
      'UPDATE "calendar_feeds" SET "last_fetched_at" = now() WHERE "id" = $1 AND "workspace_id" = $2',
      [feed.id, feed.workspaceId],
    );
  }

  /** A link made (create), replaced (update) or turned off (delete); the token and its hash stay out. */
  private audit(feed: CalendarFeed, userId: string, action: AuditAction): Promise<void> {
    return recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: feed.workspaceId,
      actorId: userId,
      entityType: EntityType.CALENDAR_FEED,
      entityId: feed.id,
      action,
      severity: Severity.WARN,
      meta: { memberId: feed.memberId },
    });
  }

  /** Another request turned the feed on, renewed or removed it between our read and write. */
  private changedMeanwhile(): ConflictException {
    return new ConflictException(appError('CALENDAR_FEED_CHANGED'));
  }

  /** A feed belongs to a membership; an instance admin looking in from outside has none. */
  private requireMember(memberId: string | null): string {
    if (!memberId) throw new ForbiddenException(appError('WORKSPACE_NOT_A_MEMBER'));
    return memberId;
  }

  private toSettings(feed: CalendarFeed | null): CalendarFeedSettings {
    if (!feed) {
      return { enabled: false, include: DEFAULT_INCLUDE, createdAt: null, lastFetchedAt: null };
    }
    return {
      enabled: true,
      include: {
        payables: feed.includePayables,
        subscriptions: feed.includeSubscriptions,
        taxDeadlines: feed.includeTaxDeadlines,
        invoices: feed.includeInvoices,
      },
      createdAt: feed.createdAt.toISOString(),
      lastFetchedAt: feed.lastFetchedAt ? feed.lastFetchedAt.toISOString() : null,
    };
  }
}
