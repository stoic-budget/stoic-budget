import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { LotMethod } from '../../common/lots/lot-book';
import type { InvestmentSettings } from '../../contracts';
import {
  WorkspaceServiceSettings,
  WorkspaceServiceSettingsKey,
} from '../../entities/workspace-service-settings.entity';

/**
 * How the workspace matches a sale to its lots: first in, first out unless
 * it chose average cost. One choice for every holding, so two holdings of the
 * same fund never report their gains two different ways.
 */
@Injectable()
export class InvestmentSettingsService {
  constructor(
    @InjectRepository(WorkspaceServiceSettings)
    private readonly settingsRepository: Repository<WorkspaceServiceSettings>,
  ) {}

  async basisMethod(workspaceId: string): Promise<LotMethod> {
    const row = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.INVESTMENTS },
    });
    return row?.config?.basisMethod === 'average' ? 'average' : 'fifo';
  }

  async getSettings(workspaceId: string): Promise<InvestmentSettings> {
    return { basisMethod: await this.basisMethod(workspaceId) };
  }

  async updateSettings(
    userId: string,
    workspaceId: string,
    settings: InvestmentSettings,
  ): Promise<InvestmentSettings> {
    const key = WorkspaceServiceSettingsKey.INVESTMENTS;
    const row =
      (await this.settingsRepository.findOne({ where: { workspaceId, key } })) ??
      this.settingsRepository.create({ workspaceId, key, config: {} });
    row.config = { ...row.config, basisMethod: settings.basisMethod };
    row.updatedByUserId = userId;
    await this.settingsRepository.save(row);
    return this.getSettings(workspaceId);
  }
}
