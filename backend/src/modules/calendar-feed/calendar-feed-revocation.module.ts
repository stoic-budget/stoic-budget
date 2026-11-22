import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarFeed } from '../../entities/calendar-feed.entity';
import { CalendarFeedRevocationService } from './calendar-feed-revocation.service';

/**
 * Only the revocation, for the auth and users modules: it needs no more than
 * the feed table, so they import it without the feed's own dependencies.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CalendarFeed])],
  providers: [CalendarFeedRevocationService],
  exports: [CalendarFeedRevocationService],
})
export class CalendarFeedRevocationModule {}
