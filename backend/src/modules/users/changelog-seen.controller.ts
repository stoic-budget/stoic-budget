import { Controller, Post, UseGuards } from '@nestjs/common';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChangelogSeen, ChangelogSeenBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChangelogSeenService } from './services/changelog-seen.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class ChangelogSeenController {
  constructor(private readonly changelogSeen: ChangelogSeenService) {}

  /**
   * Called when the What's new dialog shows an entry, by itself or by hand, so it
   * does not open by itself again on any device. Answers only the marker, which
   * the client merges into the user it already holds.
   */
  @Post('me/changelog-seen')
  @SchemaResponse(ChangelogSeen)
  async markSeen(
    @CurrentUser() currentUser: User,
    @SchemaBody(ChangelogSeenBody) body: ChangelogSeenBody,
  ) {
    return this.changelogSeen.markSeen(currentUser.id, body.id, body.date);
  }
}
