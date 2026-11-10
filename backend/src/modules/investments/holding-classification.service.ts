import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type {
  HoldingClassificationBody,
  HoldingSectorSuggestion,
  InvestmentHolding as HoldingView,
  InvestmentAllocation,
} from '../../contracts';
import { InvestmentHolding } from '../../entities/investment-holding.entity';
import { InvestmentTrade } from '../../entities/investment-trade.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { type AllocationPosition, buildAllocation, toSlices } from './allocation-math';
import {
  readClassification,
  takesLookThrough,
  toStoredLookThrough,
} from './holding-classification';
import { holdingValueIn, holdingView } from './holding-value';
import { InvestmentsService } from './investments.service';
import { SecuritySectorService } from './security-sector.service';
import { tradedHoldingIds } from './traded-holdings';

/**
 * Where a holding's money sits (sector, region, country, a fund's breakdown)
 * and the allocation that adds it all up. Holdings carry no private flag: the
 * allocation shows what `GET /investments` and the metals card already show
 * every member who may read reports.
 */
@Injectable()
export class HoldingClassificationService {
  constructor(
    @InjectRepository(InvestmentHolding)
    private readonly holdingRepository: Repository<InvestmentHolding>,
    @InjectRepository(InvestmentTrade)
    private readonly tradeRepository: Repository<InvestmentTrade>,
    private readonly investmentsService: InvestmentsService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly sectorService: SecuritySectorService,
  ) {}

  async classify(
    workspaceId: string,
    holdingId: string,
    dto: HoldingClassificationBody,
  ): Promise<HoldingView> {
    const holding = await this.requireHolding(workspaceId, holdingId);
    if (dto.lookThrough && !takesLookThrough(holding.assetClass)) {
      throw new BadRequestException(appError('INVESTMENTS_LOOK_THROUGH_FUNDS_ONLY'));
    }
    const patch: Partial<Pick<InvestmentHolding, 'sector' | 'region' | 'country' | 'lookThrough'>> =
      {};
    if (dto.sector !== undefined) patch.sector = dto.sector;
    if (dto.region !== undefined) patch.region = dto.region;
    if (dto.country !== undefined) patch.country = dto.country;
    if (dto.lookThrough !== undefined) patch.lookThrough = toStoredLookThrough(dto.lookThrough);
    if (Object.keys(patch).length > 0) {
      await this.holdingRepository.update({ id: holding.id, workspaceId }, patch);
    }
    const saved = await this.requireHolding(workspaceId, holdingId);
    const traded = await tradedHoldingIds(this.tradeRepository, workspaceId, holdingId);
    return holdingView(
      saved,
      await this.investmentsService.workspaceCurrency(workspaceId),
      this.exchangeRatesService,
      traded.size > 0,
    );
  }

  /** What the quote source says the holding's sector is; nothing is saved. */
  async suggestSector(workspaceId: string, holdingId: string): Promise<HoldingSectorSuggestion> {
    const holding = await this.requireHolding(workspaceId, holdingId);
    return { sector: holding.symbol ? await this.sectorService.sectorOf(holding.symbol) : null };
  }

  /**
   * Every holding of the workspace in its currency, cut by class, sector,
   * region and country. A holding whose price currency has no known rate is
   * left out and counted, rather than counted as nothing. An account the
   * net-worth page leaves out takes its holdings with it, as in its asset classes.
   */
  async allocation(
    workspaceId: string,
    excludedAccountIds: readonly string[] = [],
  ): Promise<InvestmentAllocation> {
    const currency = await this.investmentsService.workspaceCurrency(workspaceId);
    const excluded = new Set(excludedAccountIds);
    const holdings = (await this.holdingRepository.find({ where: { workspaceId } })).filter(
      holding => !excluded.has(holding.accountId),
    );
    const positions: AllocationPosition[] = [];
    let unvalued = 0;
    for (const holding of holdings) {
      const value = await holdingValueIn(holding, currency, this.exchangeRatesService);
      if (value === null) {
        unvalued += 1;
        continue;
      }
      positions.push({
        cents: Math.round(value * 100),
        assetClass: holding.assetClass,
        metal: holding.metal,
        classification: readClassification(holding),
      });
    }
    const totals = buildAllocation(positions);
    const total = totals.totalCents;
    return {
      currency,
      total: total / 100,
      unvalued,
      classes: toSlices<InvestmentAllocation['classes'][number]['key']>(
        new Map([...totals.classes].map(([key, sub]) => [key, sum(sub)])),
        total,
      ).map(slice => ({
        ...slice,
        subclasses: toSlices(totals.classes.get(slice.key) ?? new Map(), total),
      })),
      sectors: toSlices(totals.sector, total),
      regions: toSlices(totals.region, total),
      countries: toSlices(totals.country, total),
    };
  }

  private async requireHolding(workspaceId: string, holdingId: string): Promise<InvestmentHolding> {
    const holding = await this.holdingRepository.findOne({ where: { id: holdingId, workspaceId } });
    if (!holding) throw new NotFoundException(appError('INVESTMENTS_HOLDING_NOT_FOUND'));
    return holding;
  }
}

const sum = (map: Map<string, number>) =>
  [...map.values()].reduce((total, cents) => total + cents, 0);
