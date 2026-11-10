import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, type Repository } from 'typeorm';
import { notInVersionWorkspace } from '../../common/workspaces/version-workspaces';
import type { PriceHealth } from '../../contracts';
import { InvestmentHolding } from '../../entities/investment-holding.entity';
import { SecurityPrice } from '../../entities/security-price.entity';
import { SecurityPriceSymbol } from '../../entities/security-price-symbol.entity';
import { WorkspaceSecurityPrice } from '../../entities/workspace-security-price.entity';
import { type DatedClose, healthView, mergeCloses, nextHealth } from './price-history';
import { StockPriceService } from './stock-price.service';

/** While a first backfill keeps failing, it is tried again at most this often. */
const RETRY_BACKFILL_MS = 60 * 60 * 1000;
/** Rows per INSERT: ten years of closes in a handful of statements. */
const UPSERT_CHUNK = 500;

/**
 * Daily closes. The feed's closes and its health per symbol are shared by
 * every workspace (market data, nothing a workspace typed); a workspace's own
 * closes sit in their own table and are laid over the feed's only when that
 * workspace reads. So the feed is fetched once per symbol for everyone, and
 * one workspace's close never moves another's figures.
 */
@Injectable()
export class SecurityPricesService {
  private readonly logger = new Logger(SecurityPricesService.name);

  constructor(
    @InjectRepository(SecurityPrice)
    private readonly priceRepository: Repository<SecurityPrice>,
    @InjectRepository(SecurityPriceSymbol)
    private readonly symbolRepository: Repository<SecurityPriceSymbol>,
    @InjectRepository(WorkspaceSecurityPrice)
    private readonly ownRepository: Repository<WorkspaceSecurityPrice>,
    @InjectRepository(InvestmentHolding)
    private readonly holdingRepository: Repository<InvestmentHolding>,
    private readonly stockPriceService: StockPriceService,
  ) {}

  /**
   * First use of a symbol: its history is fetched now (ten years, bounded),
   * once. A symbol whose backfill failed is tried again an hour later at the
   * earliest, so opening a holding again and again does not hammer the feed.
   */
  async ensureBackfilled(symbol: string, now = new Date()): Promise<void> {
    const row = await this.symbolRepository.findOne({ where: { symbol } });
    if (row?.backfilledAt) return;
    if (row?.lastAttemptAt && now.getTime() - row.lastAttemptAt.getTime() < RETRY_BACKFILL_MS) {
      return;
    }
    await this.fetchAndStore(symbol, row, now);
  }

  /**
   * The daily job. Every symbol a live workspace holds is fetched once: the
   * closes are the same for every holder, so the symbols are picked across
   * workspaces on purpose, and nothing of any workspace is read or written
   * beyond the symbol itself. A past version is a frozen copy and is skipped.
   */
  async recordDailyCloses(now = new Date()): Promise<{ fetched: number; failed: number }> {
    const rows = await this.holdingRepository
      .createQueryBuilder('holding')
      .select('DISTINCT holding.symbol', 'symbol')
      .where('holding.symbol IS NOT NULL')
      .andWhere(notInVersionWorkspace('holding.workspaceId'))
      .getRawMany<{ symbol: string }>();
    const symbols = rows.map(row => row.symbol).sort();
    const known = await this.symbolRepository.find({ where: { symbol: In(symbols) } });
    let failed = 0;
    for (const symbol of symbols) {
      try {
        const ok = await this.fetchAndStore(
          symbol,
          known.find(row => row.symbol === symbol) ?? null,
          now,
        );
        if (!ok) failed += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(`Daily closes for ${symbol} failed`, (error as Error)?.stack);
      }
    }
    return { fetched: symbols.length - failed, failed };
  }

  /** The feed's closes of `symbols` with this workspace's own laid over them, by date. */
  async closesFor(
    workspaceId: string,
    symbols: string[],
    from?: string,
  ): Promise<Map<string, DatedClose[]>> {
    const wanted = [...new Set(symbols)];
    const result = new Map<string, DatedClose[]>();
    if (wanted.length === 0) return result;
    const since = from ? { priceDate: MoreThanOrEqual(from) } : {};
    const feed = await this.priceRepository.find({
      where: { symbol: In(wanted), ...since },
      order: { priceDate: 'ASC' },
    });
    const own = await this.ownRepository.find({
      where: { workspaceId, symbol: In(wanted), ...since },
      order: { priceDate: 'ASC' },
    });
    for (const symbol of wanted) {
      result.set(
        symbol,
        mergeCloses(
          feed.filter(row => row.symbol === symbol).map(row => toClose(row, 'auto')),
          own.filter(row => row.symbol === symbol).map(row => toClose(row, row.source)),
        ),
      );
    }
    return result;
  }

  /** How each symbol's closes are doing, as this workspace sees them. */
  async healthFor(workspaceId: string, symbols: string[]): Promise<Map<string, PriceHealth>> {
    const wanted = [...new Set(symbols)];
    const result = new Map<string, PriceHealth>();
    if (wanted.length === 0) return result;
    const feed = await this.symbolRepository.find({ where: { symbol: In(wanted) } });
    const own = await this.ownRepository
      .createQueryBuilder('close')
      .select('close.symbol', 'symbol')
      .addSelect('MAX(close.priceDate)', 'latest')
      .where('close.workspaceId = :workspaceId', { workspaceId })
      .andWhere('close.symbol IN (:...wanted)', { wanted })
      .groupBy('close.symbol')
      .getRawMany<{ symbol: string; latest: string | Date }>();
    for (const symbol of wanted) {
      const latest = own.find(row => row.symbol === symbol)?.latest ?? null;
      result.set(
        symbol,
        healthView(
          feed.find(row => row.symbol === symbol) ?? null,
          latest === null ? null : dateOnly(latest),
        ),
      );
    }
    return result;
  }

  /** One fetch of a symbol, its closes stored and its health moved on. True when it brought closes. */
  private async fetchAndStore(
    symbol: string,
    previous: SecurityPriceSymbol | null,
    now: Date,
  ): Promise<boolean> {
    const range = previous?.backfilledAt ? '1mo' : '10y';
    const fetched = await this.stockPriceService.fetchDailyCloses(symbol, range);
    const closes = fetched?.closes ?? [];
    for (let offset = 0; offset < closes.length; offset += UPSERT_CHUNK) {
      await this.priceRepository
        .createQueryBuilder()
        .insert()
        .into(SecurityPrice)
        .values(
          closes.slice(offset, offset + UPSERT_CHUNK).map(close => ({
            symbol,
            priceDate: close.date,
            close: String(close.close),
            currency: fetched?.currency ?? '',
          })),
        )
        // The feed corrects its own past bars; the latest answer wins.
        .orUpdate(['close', 'currency', 'updated_at'], ['symbol', 'price_date'])
        .execute();
    }
    const health = nextHealth(previous, fetched ? closes.map(close => close.date) : null, now);
    await this.symbolRepository.save({
      symbol,
      currency: fetched?.currency ?? previous?.currency ?? null,
      ...health,
      backfilledAt: previous?.backfilledAt ?? (range === '10y' && closes.length > 0 ? now : null),
    });
    return closes.length > 0;
  }
}

function toClose(
  row: Pick<SecurityPrice, 'priceDate' | 'close' | 'currency'>,
  source: DatedClose['source'],
): DatedClose {
  return {
    date: dateOnly(row.priceDate),
    close: Number(row.close),
    currency: row.currency,
    source,
  };
}

/** A `date` column as `YYYY-MM-DD`, whether the driver gave a string or a Date. */
function dateOnly(value: string | Date): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}
