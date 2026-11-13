import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from '../../entities/tag.entity';
import { Transaction } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { TagSummaryService } from './tag-summary.service';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tag, User, WorkspaceMember, Transaction]),
    AuditModule,
    ExchangeRatesModule,
    WorkspaceCurrencyModule,
  ],
  controllers: [TagsController],
  providers: [TagsService, TagSummaryService],
  exports: [TagsService],
})
export class TagsModule {}
