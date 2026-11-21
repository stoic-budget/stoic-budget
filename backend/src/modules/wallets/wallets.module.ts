import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { LoansModule } from '../loans/loans.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { WalletStatementsService } from './wallet-statements.service';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WorkspaceMember, Transaction, Statement]),
    WorkspaceCurrencyModule,
    ExchangeRatesModule,
    // Loan terms and schedules live on debt wallets; registered here so the app module stays small.
    LoansModule,
  ],
  controllers: [WalletsController],
  providers: [WalletsService, WalletStatementsService],
  exports: [WalletsService],
})
export class WalletsModule {}
