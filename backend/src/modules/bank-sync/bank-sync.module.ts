import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { fetchPublicUrl } from '../../common/utils/egress-url.util';
import { Integration, OpenProtocolSettings, Transaction, Wallet } from '../../entities';
import { ImportModule } from '../import/import.module';
import { StatementsModule } from '../statements/statements.module';
import { TaxModule } from '../tax/tax.module';
import { BankSyncController } from './bank-sync.controller';
import { BankSyncService } from './bank-sync.service';
import { BankSyncDedupeService } from './bank-sync-dedupe.service';
import { BankSyncPendingService } from './bank-sync-pending.service';
import { BANK_SYNC_FETCH, BANK_SYNC_PROVIDERS } from './bank-sync-provider.interface';
import { BankSyncPullService } from './bank-sync-pull.service';
import { EnableBankingProvider } from './enable-banking.provider';
import { SimpleFinProvider } from './simplefin.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, OpenProtocolSettings, Transaction, Wallet]),
    StatementsModule,
    ImportModule,
    TaxModule,
  ],
  controllers: [BankSyncController],
  providers: [
    BankSyncService,
    BankSyncPullService,
    BankSyncDedupeService,
    BankSyncPendingService,
    SimpleFinProvider,
    EnableBankingProvider,
    { provide: BANK_SYNC_FETCH, useValue: fetchPublicUrl },
    {
      provide: BANK_SYNC_PROVIDERS,
      useFactory: (simplefin: SimpleFinProvider, enableBanking: EnableBankingProvider) => [
        simplefin,
        enableBanking,
      ],
      inject: [SimpleFinProvider, EnableBankingProvider],
    },
  ],
  exports: [BankSyncService, BankSyncPullService],
})
export class BankSyncModule {}
