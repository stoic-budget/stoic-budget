import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type {
  ImportClosesResult,
  ImportSecurityClosesBody,
  SecurityClose as SecurityCloseView,
  UpsertSecurityCloseBody,
} from '../../contracts';
import { InvestmentHolding, InvestmentPriceSource } from '../../entities/investment-holding.entity';
import {
  WorkspaceSecurityPrice,
  WorkspaceSecurityPriceSource,
} from '../../entities/workspace-security-price.entity';
import { isoDate, shiftDays } from '../balance/snapshot-series';
import { parseClosesCsv } from './closes-csv';
import { InvestmentsService } from './investments.service';
import { SecurityPricesService } from './security-prices.service';

/** A price a holding takes from a close, and the day that close is from. */
interface ClosePrice {
  day: string;
  close: number;
  currency: string;
  source: InvestmentPriceSource;
}

/**
 * Closes a workspace types in or imports for the symbol of one of its
 * holdings. They are the workspace's own: stored with its id, read only by
 * it, and laid over the feed's closes in its figures alone. The newest of
 * them, when it is newer than a holding's price, becomes that price: a close
 * typed in because the feed stopped is meant to move the figures. Deleting the
 * close a price came from takes the price back to the newest close left.
 */
@Injectable()
export class SecurityClosesService {
  constructor(
    @InjectRepository(WorkspaceSecurityPrice)
    private readonly closeRepository: Repository<WorkspaceSecurityPrice>,
    @InjectRepository(InvestmentHolding)
    private readonly holdingRepository: Repository<InvestmentHolding>,
    private readonly investmentsService: InvestmentsService,
    private readonly prices: SecurityPricesService,
  ) {}

  /** The workspace's own closes for the holding's symbol, newest first. */
  async list(workspaceId: string, holdingId: string): Promise<SecurityCloseView[]> {
    const { symbol } = await this.requireSymbol(workspaceId, holdingId);
    const rows = await this.closeRepository.find({
      where: { workspaceId, symbol },
      order: { priceDate: 'DESC' },
    });
    return rows.map(toView);
  }

  /** One day's close, replacing the workspace's own close of that day. */
  async upsert(
    userId: string,
    workspaceId: string,
    holdingId: string,
    body: UpsertSecurityCloseBody,
  ): Promise<SecurityCloseView> {
    const holding = await this.requireSymbol(workspaceId, holdingId);
    if (body.date > latestDay()) {
      throw new BadRequestException(appError('INVESTMENTS_CLOSE_IN_FUTURE'));
    }
    const currency = (body.currency ?? holding.priceCurrency).trim().toUpperCase();
    await this.write(workspaceId, holding.symbol, currency, WorkspaceSecurityPriceSource.MANUAL, [
      { date: body.date, close: Number(body.close) },
    ]);
    await this.priceHoldings(userId, workspaceId, holding.symbol, [body.date]);
    const stored = await this.closeRepository.findOneOrFail({
      where: { workspaceId, symbol: holding.symbol, priceDate: body.date },
    });
    return toView(stored);
  }

  async remove(userId: string, workspaceId: string, closeId: string): Promise<void> {
    const close = await this.closeRepository.findOne({ where: { id: closeId, workspaceId } });
    if (!close) throw new NotFoundException(appError('INVESTMENTS_CLOSE_NOT_FOUND'));
    await this.closeRepository.delete({ id: close.id, workspaceId });
    await this.repriceAfterRemoval(userId, workspaceId, close);
  }

  /** The closes of a CSV file; a day the workspace already has is replaced. */
  async import(
    userId: string,
    workspaceId: string,
    holdingId: string,
    body: ImportSecurityClosesBody,
  ): Promise<ImportClosesResult> {
    const holding = await this.requireSymbol(workspaceId, holdingId);
    const { rows, skipped } = parseClosesCsv(body.csv, latestDay());
    const currency = (body.currency ?? holding.priceCurrency).trim().toUpperCase();
    const existing = rows.length
      ? await this.closeRepository.count({
          where: { workspaceId, symbol: holding.symbol, priceDate: In(rows.map(row => row.date)) },
        })
      : 0;
    await this.write(
      workspaceId,
      holding.symbol,
      currency,
      WorkspaceSecurityPriceSource.IMPORT,
      rows,
    );
    await this.priceHoldings(
      userId,
      workspaceId,
      holding.symbol,
      rows.map(row => row.date),
    );
    return { created: rows.length - existing, updated: existing, skipped };
  }

  /**
   * The workspace's newest own close becomes the price of its holdings of the
   * symbol that were priced before that day, and their accounts' value is
   * written again. Only when this call wrote that close: typing in or
   * importing older closes leaves today's price. A holding priced later (a
   * fresh quote) keeps its price.
   */
  private async priceHoldings(
    userId: string,
    workspaceId: string,
    symbol: string,
    written: string[],
  ): Promise<void> {
    const latest = await this.closeRepository.findOne({
      where: { workspaceId, symbol },
      order: { priceDate: 'DESC' },
    });
    if (!latest) return;
    const day = dateOnly(latest.priceDate);
    if (!written.includes(day)) return;
    const holdings = await this.holdingRepository.find({ where: { workspaceId, symbol } });
    await this.applyPrice(
      userId,
      workspaceId,
      holdings.filter(holding => !(holding.pricedAt && isoDate(holding.pricedAt) > day)),
      {
        day,
        close: Number(latest.close),
        currency: latest.currency,
        source: InvestmentPriceSource.MANUAL,
      },
    );
  }

  /**
   * The holdings whose price came from the close just deleted take the newest
   * close left, the feed's or the workspace's: a mistyped close does not stay
   * behind as the price. With no close left, the price stays as typed.
   */
  private async repriceAfterRemoval(
    userId: string,
    workspaceId: string,
    removed: WorkspaceSecurityPrice,
  ): Promise<void> {
    const day = dateOnly(removed.priceDate);
    const holdings = await this.holdingRepository.find({
      where: { workspaceId, symbol: removed.symbol },
    });
    const fromRemoved = holdings.filter(
      holding =>
        holding.priceSource === InvestmentPriceSource.MANUAL &&
        holding.pricedAt !== null &&
        isoDate(holding.pricedAt) === day &&
        Math.abs(Number(holding.price) - Number(removed.close)) < 1e-9 &&
        holding.priceCurrency === removed.currency,
    );
    if (fromRemoved.length === 0) return;
    const closes = (await this.prices.closesFor(workspaceId, [removed.symbol])).get(removed.symbol);
    const next = closes?.[closes.length - 1];
    if (!next) return;
    await this.applyPrice(userId, workspaceId, fromRemoved, {
      day: next.date,
      close: next.close,
      currency: next.currency,
      source: next.source === 'auto' ? InvestmentPriceSource.AUTO : InvestmentPriceSource.MANUAL,
    });
  }

  private async applyPrice(
    userId: string,
    workspaceId: string,
    holdings: InvestmentHolding[],
    price: ClosePrice,
  ): Promise<void> {
    const accounts = new Set<string>();
    for (const holding of holdings) {
      await this.holdingRepository.update(
        { id: holding.id, workspaceId },
        {
          price: price.close,
          priceCurrency: price.currency,
          priceSource: price.source,
          // The day the price is from, not the moment it was typed: its age stays honest.
          pricedAt: new Date(`${price.day}T00:00:00.000Z`),
        },
      );
      accounts.add(holding.accountId);
    }
    for (const accountId of accounts) {
      await this.investmentsService.writeSnapshot(userId, workspaceId, accountId);
    }
  }

  private async write(
    workspaceId: string,
    symbol: string,
    currency: string,
    source: WorkspaceSecurityPriceSource,
    closes: Array<{ date: string; close: number }>,
  ): Promise<void> {
    for (let offset = 0; offset < closes.length; offset += 500) {
      await this.closeRepository
        .createQueryBuilder()
        .insert()
        .into(WorkspaceSecurityPrice)
        .values(
          closes.slice(offset, offset + 500).map(close => ({
            workspaceId,
            symbol,
            priceDate: close.date,
            close: String(close.close),
            currency,
            source,
          })),
        )
        // The conflict target holds the workspace: a close only ever replaces this workspace's own.
        .orUpdate(
          ['close', 'currency', 'source', 'updated_at'],
          ['workspace_id', 'symbol', 'price_date'],
        )
        .execute();
    }
  }

  private async requireSymbol(
    workspaceId: string,
    holdingId: string,
  ): Promise<InvestmentHolding & { symbol: string }> {
    const holding = await this.holdingRepository.findOne({ where: { id: holdingId, workspaceId } });
    if (!holding) throw new NotFoundException(appError('INVESTMENTS_HOLDING_NOT_FOUND'));
    if (!holding.symbol) throw new BadRequestException(appError('INVESTMENTS_HOLDING_NO_SYMBOL'));
    return holding as InvestmentHolding & { symbol: string };
  }
}

/**
 * The latest day a close may be for: the user's today, which east of UTC is
 * already tomorrow's date here (as far as UTC+14).
 */
function latestDay(): string {
  return shiftDays(isoDate(new Date()), 1);
}

function dateOnly(value: string | Date): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function toView(row: WorkspaceSecurityPrice): SecurityCloseView {
  return {
    id: row.id,
    symbol: row.symbol,
    date: dateOnly(row.priceDate),
    close: Number(row.close),
    currency: row.currency,
    source: row.source,
  };
}
