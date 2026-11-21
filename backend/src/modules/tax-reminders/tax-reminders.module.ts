import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxReturn } from '../../entities/tax-return.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceServiceSettings } from '../../entities/workspace-service-settings.entity';
import { ReferenceDataModule } from '../reference-data/reference-data.module';
import { TaxModule } from '../tax/tax.module';
import { TaxDeadlinesController } from './tax-deadlines.controller';
import { TaxDeadlinesService } from './tax-deadlines.service';

/**
 * Due dates of tax returns and the daily reminder sweep. VAT returns come
 * from the tax module; any other return from a `TAX_DEADLINE_SOURCE`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, TaxReturn, WorkspaceServiceSettings]),
    TaxModule,
    ReferenceDataModule,
  ],
  controllers: [TaxDeadlinesController],
  providers: [TaxDeadlinesService],
  exports: [TaxDeadlinesService],
})
export class TaxRemindersModule {}
