import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import { CryptoWallet } from '../../entities/crypto-wallet.entity';
import { CryptoBalanceService } from './crypto-balance.service';

/**
 * Once a day, every workspace with crypto gets today's portfolio value on its
 * balance sheet (#694). The chain sync writes it too, but only for addresses
 * and only when the sync succeeds: manual holdings and exchange files, whose
 * prices move all the same, and a wallet whose sync fails, would otherwise
 * keep an old value in net worth and add no point to its chart.
 */
@Injectable()
export class CryptoSnapshotScheduler {
  private readonly logger = new Logger(CryptoSnapshotScheduler.name);

  constructor(
    @InjectRepository(CryptoWallet)
    private readonly walletRepo: Repository<CryptoWallet>,
    private readonly balanceService: CryptoBalanceService,
  ) {}

  @Cron('30 5 * * *')
  async writeDailySnapshots(): Promise<void> {
    // A past version keeps the value it was copied with.
    const rows: Array<{ workspaceId: string }> = await this.walletRepo
      .createQueryBuilder('wallet')
      .innerJoin('wallet.workspace', 'workspace')
      .select('DISTINCT wallet.workspaceId', 'workspaceId')
      .where('workspace.kind = :kind', STANDARD_WORKSPACE)
      .getRawMany();
    for (const { workspaceId } of rows) {
      // One workspace's failure must not stop the others'.
      await this.balanceService
        .writePortfolioSnapshot(workspaceId)
        .catch(error => this.logger.warn(`Snapshot failed for ${workspaceId}: ${String(error)}`));
    }
  }
}
