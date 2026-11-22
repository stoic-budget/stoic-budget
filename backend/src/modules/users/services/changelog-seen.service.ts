import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { ChangelogSeen } from '../../../contracts';
import { User } from '../../../entities/user.entity';

/** The What's new marker: the newest changelog entry a user has seen, on every device. */
@Injectable()
export class ChangelogSeenService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /**
   * Moves the caller's marker to the entry `id` dated `date`, only forward: one
   * conditional UPDATE, so an older client, tab or late request cannot move it
   * back, and two requests at once end at the newer entry. Answers the stored
   * marker, which may be a newer one than the entry sent.
   */
  async markSeen(userId: string, id: string, date: string): Promise<ChangelogSeen> {
    await this.users.query(
      `UPDATE "users"
       SET "changelog_seen_id" = $2, "changelog_seen_at" = $3::timestamptz
       WHERE "id" = $1
         AND ("changelog_seen_at" IS NULL OR "changelog_seen_at" < $3::timestamptz)`,
      [userId, id, date],
    );
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, changelogSeenId: true, changelogSeenAt: true },
    });
    return {
      changelogSeenId: user?.changelogSeenId ?? null,
      changelogSeenAt: user?.changelogSeenAt?.toISOString() ?? null,
    };
  }
}
