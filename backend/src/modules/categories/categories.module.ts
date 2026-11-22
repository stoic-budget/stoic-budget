import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Statement, Transaction, User, WorkspaceMember } from '../../entities';
import { Category } from '../../entities/category.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategorySummaryService } from './category-summary.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, User, WorkspaceMember, Transaction, Statement]),
    AuditModule,
    ExchangeRatesModule,
    WorkspaceCurrencyModule,
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategorySummaryService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
