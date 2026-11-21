import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanTerms } from '../../entities/loan-terms.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { LoanScheduleService } from './loan-schedule.service';
import { LoanTermsService } from './loan-terms.service';
import { LoansController } from './loans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LoanTerms, Wallet, Transaction]), ExchangeRatesModule],
  controllers: [LoansController],
  providers: [LoanTermsService, LoanScheduleService],
})
export class LoansModule {}
