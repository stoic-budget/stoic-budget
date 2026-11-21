import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CalendarFeed } from '../../entities/calendar-feed.entity';

/**
 * Ends a person's calendar feed links in every workspace, when their account
 * is taken back: "log out everywhere", a password reset, a deactivation. The
 * rows go, so a later reactivation does not bring an old link back.
 */
@Injectable()
export class CalendarFeedRevocationService {
  constructor(
    @InjectRepository(CalendarFeed)
    private readonly feedRepository: Repository<CalendarFeed>,
  ) {}

  /** Keyed by the user, not one workspace: every membership of theirs loses its link. */
  async revokeAllOf(userId: string): Promise<void> {
    await this.feedRepository
      .createQueryBuilder()
      .delete()
      .from(CalendarFeed)
      .where('member_id IN (SELECT m.id FROM workspace_members m WHERE m.user_id = :userId)', {
        userId,
      })
      .execute();
  }
}
