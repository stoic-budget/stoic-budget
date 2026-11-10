import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanTerms } from '../../entities/loan-terms.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { LoanPaymentSplitService } from './loan-payment-split.service';
import { LoanPaymentsController } from './loan-payments.controller';
import { LoanPaymentsService } from './loan-payments.service';
import { LoanPaymentsEventsListener } from './loan-payments-events.listener';
import { LoanScheduleService } from './loan-schedule.service';
import { LoanTermsService } from './loan-terms.service';
import { LoansController } from './loans.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoanTerms, Wallet, Transaction, WorkspaceMember]),
    ExchangeRatesModule,
    AuditModule,
  ],
  controllers: [LoansController, LoanPaymentsController],
  providers: [
    LoanTermsService,
    LoanScheduleService,
    LoanPaymentsService,
    LoanPaymentSplitService,
    LoanPaymentsEventsListener,
  ],
})
export class LoansModule {}
