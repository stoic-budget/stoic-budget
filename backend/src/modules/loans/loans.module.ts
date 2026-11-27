import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanTerms } from '../../entities/loan-terms.entity';
import { Payable } from '../../entities/payable.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { PayablesModule } from '../payables/payables.module';
import { LoanAccountRemovalSubscriber } from './loan-account-removal.subscriber';
import { LoanInterestCarryService } from './loan-interest-carry.service';
import { LoanInterestGuardSubscriber } from './loan-interest-guard.subscriber';
import { LoanPaymentMatcher } from './loan-payment-matcher';
import { LoanPaymentSplitService } from './loan-payment-split.service';
import { LoanPaymentsController } from './loan-payments.controller';
import { LoanPaymentsService } from './loan-payments.service';
import { LoanPaymentsEventsListener } from './loan-payments-events.listener';
import { LoanRemindersListener } from './loan-reminders.listener';
import { LoanRemindersService } from './loan-reminders.service';
import { LoanScheduleService } from './loan-schedule.service';
import { LoanTermsService } from './loan-terms.service';
import { LoansController } from './loans.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoanTerms, Wallet, Transaction, WorkspaceMember, Payable]),
    ExchangeRatesModule,
    AuditModule,
    PayablesModule,
  ],
  controllers: [LoansController, LoanPaymentsController],
  providers: [
    LoanTermsService,
    LoanScheduleService,
    LoanPaymentsService,
    LoanPaymentSplitService,
    LoanInterestCarryService,
    LoanInterestGuardSubscriber,
    LoanAccountRemovalSubscriber,
    LoanPaymentsEventsListener,
    LoanPaymentMatcher,
    LoanRemindersService,
    LoanRemindersListener,
  ],
})
export class LoansModule {}
