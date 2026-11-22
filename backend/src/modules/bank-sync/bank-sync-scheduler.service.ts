import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { UpdateBankSyncConnectionBody } from '../../contracts';
import { Integration, type User } from '../../entities';
import { type BankSyncConnection, BankSyncService } from './bank-sync.service';
import { type BankSyncClaim, BankSyncClaimsService } from './bank-sync-claims.service';
import { BankSyncPullService, type BankSyncResult } from './bank-sync-pull.service';
import { byWorkspace } from './bank-sync-schedule';

/** Connections leased per claim: few enough that each finishes well inside its lease. */
const CLAIM_BATCH = 10;
/** A tick stops claiming after this, so it is done before the next one starts. */
const TICK_BUDGET_MS = 12 * 60_000;

/**
 * Runs bank-sync pulls: the automatic ones when a connection's interval comes
 * round, and the ones the user asks for. Both go through a lease on the
 * connection, and both record how the pull went, so a failing provider is
 * backed off instead of asked again every tick.
 */
@Injectable()
export class BankSyncSchedulerService {
  private readonly logger = new Logger(BankSyncSchedulerService.name);
  private ticking = false;

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly connections: BankSyncService,
    private readonly claims: BankSyncClaimsService,
    private readonly pull: BankSyncPullService,
  ) {}

  /** Every 15 minutes: pulls the connections that are due, as the user who connected each. */
  @Cron('0 */15 * * * *')
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const providers = this.connections.catalogue().map(item => item.key);
      const started = Date.now();
      while (Date.now() - started < TICK_BUDGET_MS) {
        const claimed = await this.claims.claimDue(providers, CLAIM_BATCH);
        if (claimed.length === 0) break;
        for (const workspace of byWorkspace(claimed)) {
          for (const claim of workspace) await this.pullInBackground(claim);
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  /** "Sync now": skips the wait and the backoff, but not a pull already running. */
  async syncNow(user: User, workspaceId: string, connectionId: string): Promise<BankSyncResult> {
    await this.connections.require(workspaceId, connectionId);
    const claim = await this.claims.claimOne(workspaceId, connectionId);
    return this.pullClaimed(user, claim);
  }

  /** Label and auto-sync live in the config; the interval in the schedule. */
  async updateConnection(
    workspaceId: string,
    connectionId: string,
    body: UpdateBankSyncConnectionBody,
  ): Promise<BankSyncConnection> {
    if (body.syncIntervalHours != null) {
      const { settings } = await this.connections.require(workspaceId, connectionId);
      await this.claims.setInterval(settings, body.syncIntervalHours);
    }
    return this.connections.updateConnection(workspaceId, connectionId, body);
  }

  private async pullClaimed(user: User, claim: BankSyncClaim): Promise<BankSyncResult> {
    try {
      const result = await this.pull.sync(user, claim.workspaceId, claim.connectionId);
      await this.claims.recordSuccess(claim);
      return result;
    } catch (error) {
      await this.claims.recordFailure(claim, error);
      throw error;
    }
  }

  private async pullInBackground(claim: BankSyncClaim): Promise<void> {
    try {
      const integration = await this.integrationRepository.findOne({
        where: { id: claim.connectionId, workspaceId: claim.workspaceId },
        relations: { connectedByUser: true },
      });
      if (!integration?.connectedByUser) {
        await this.claims.recordFailure(claim, new Error('no member to pull as'));
        return;
      }
      const result = await this.pullClaimed(integration.connectedByUser, claim);
      if (result.imported > 0) {
        this.logger.log(
          `Bank sync: connection ${claim.connectionId} pulled ${result.imported} rows into ${result.statements} statements`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Bank sync: connection ${claim.connectionId} failed: ${message}`);
    }
  }
}
