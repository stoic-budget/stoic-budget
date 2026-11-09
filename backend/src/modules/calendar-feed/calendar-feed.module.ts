import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarFeed } from '../../entities/calendar-feed.entity';
import { Invoice } from '../../entities/invoice.entity';
import { Payable } from '../../entities/payable.entity';
import { Subscription } from '../../entities/subscription.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { TaxRemindersModule } from '../tax-reminders/tax-reminders.module';
import { CalendarFeedController } from './calendar-feed.controller';
import { CalendarFeedService } from './calendar-feed.service';
import { CalendarFeedEventsService } from './calendar-feed-events.service';
import { CalendarFeedPayablesService } from './calendar-feed-payables.service';
import { PublicCalendarFeedController } from './public-calendar-feed.controller';
import { PublicCalendarFeedService } from './public-calendar-feed.service';

/** A member's ICS feed of upcoming money dates, and the settings that turn it on. */
@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarFeed, Payable, Subscription, Invoice, WorkspaceMember]),
    TaxRemindersModule,
  ],
  controllers: [CalendarFeedController, PublicCalendarFeedController],
  providers: [
    CalendarFeedService,
    CalendarFeedEventsService,
    CalendarFeedPayablesService,
    PublicCalendarFeedService,
  ],
})
export class CalendarFeedModule {}
