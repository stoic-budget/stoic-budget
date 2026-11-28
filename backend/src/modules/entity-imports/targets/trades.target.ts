import { In } from 'typeorm';
import { BalanceAccount, BalanceAccountKind } from '../../../entities/balance-account.entity';
import {
  InvestmentAssetClass,
  InvestmentHolding,
  InvestmentPriceSource,
} from '../../../entities/investment-holding.entity';
import {
  InvestmentTrade,
  type InvestmentTradeKind,
} from '../../../entities/investment-trade.entity';
import { normalizeStockSymbol } from '../../investments/stock-price.service';
import {
  countsUnits,
  replayTrades,
  splitFactorSince,
  type TradeEvent,
  type TradeKind,
  TradeReplayError,
} from '../../investments/trade-ledger';
import { ENTRY_ORDER, normalizeTrade, pricedOn, toTradeEvent } from '../../investments/trade-rules';
import {
  detectDateOrder,
  nameKey,
  normalizeCurrencyCode,
  parseImportDate,
  parseImportNumber,
} from '../helpers/import-values';
import { resolveEnumAlias } from '../target-aliases';
import type { ImportContext, ImportTarget, RowResult } from './target.types';
import { balanceDifference, bookKey, coveredByLater, statedBookEnds } from './trade-balance';
import { bySymbol, parseRatio, sameTrade } from './trade-rows';

export { parseRatio } from './trade-rows';

/** A holding the rows go to, with the trades it has and the ones this run adds. */
interface Book {
  holding: InvestmentHolding;
  isNew: boolean;
  events: TradeEvent[];
  /** How many of `events` were stored before this run. */
  stored: number;
  /** Stored trades a row of this run already matched as the same trade. */
  matched: Set<string>;
  currency: string | null;
  touched: boolean;
}

const RULE_REASONS = {
  INVESTMENTS_TRADE_QUANTITY_REQUIRED: 'quantity',
  INVESTMENTS_TRADE_AMOUNT_REQUIRED: 'amount',
  INVESTMENTS_TRADE_RATIO_REQUIRED: 'ratio',
} as const;

/**
 * A broker's export: one row per trade. Rows find their holding by symbol,
 * then by name, among the investment accounts (or the one chosen); a holding
 * nobody has yet is created only when the user asked for that, in the chosen
 * account. Every row is replayed against the holding's history first, so a
 * sale the sheet cannot cover is an error row, not a gain from nothing.
 *
 * Quantities are taken as positive whatever sign the broker writes; a buy or
 * sell without a price is priced from its amount. A split's ratio reads as
 * new for old: "3:1", "3 for 1", "1/10".
 */
export class TradesTarget implements ImportTarget {
  readonly kind = 'trades' as const;

  async run(rows: string[][], ctx: ImportContext, dryRun: boolean): Promise<RowResult[]> {
    const accounts = await ctx.manager.getRepository(BalanceAccount).find({
      where: {
        workspaceId: ctx.workspaceId,
        accountKind: In([BalanceAccountKind.INVESTMENT, BalanceAccountKind.RETIREMENT]),
        ...(ctx.investmentAccountId ? { id: ctx.investmentAccountId } : {}),
      },
      select: { id: true },
    });
    if (ctx.investmentAccountId && accounts.length === 0) {
      return rows.map((_, index) => ({ index, status: 'error', reason: 'account' }));
    }
    const holdings = accounts.length
      ? await ctx.manager.getRepository(InvestmentHolding).find({
          where: { workspaceId: ctx.workspaceId, accountId: In(accounts.map(item => item.id)) },
        })
      : [];
    const tradable = holdings.filter(holding => holding.assetClass !== InvestmentAssetClass.METAL);
    const books = new Map<string, Book>();
    const order = detectDateOrder(rows.map(row => ctx.cell(row, 'date')));
    const base = Date.now();
    const results: RowResult[] = [];
    const statementEnds = statedBookEnds(rows, ctx, order);

    for (const [index, row] of rows.entries()) {
      const stated = resolveEnumAlias('tradeKind', ctx.cell(row, 'kind')) as
        | TradeKind
        | 'balance'
        | null;
      if (!stated) {
        results.push({ index, status: 'error', reason: 'kind' });
        continue;
      }
      const date = parseImportDate(ctx.cell(row, 'date'), order);
      if (!date) {
        results.push({ index, status: 'error', reason: 'date' });
        continue;
      }
      const found = await this.book(row, ctx, tradable, books, dryRun);
      if (typeof found === 'string') {
        results.push({ index, status: 'error', reason: found });
        continue;
      }
      // Rows a later statement already counts, and a balance the holding already has, are skipped.
      const end = statementEnds.get(bookKey(row, ctx) ?? '');
      const covered = coveredByLater(found.events.slice(0, found.stored), end);
      // A balance moves in or out what the holding lacks or has over at the start of its day.
      const difference =
        stated === 'balance'
          ? balanceDifference(found.events, ctx.cell(row, 'quantity'), date)
          : null;
      if (!covered && stated === 'balance' && difference === null) {
        results.push({ index, status: 'error', reason: 'quantity' });
        continue;
      }
      if (covered || (difference !== null && Math.abs(difference) < 1e-9)) {
        results.push({ index, status: 'skipped', reason: 'duplicate' });
        continue;
      }
      const kind: TradeKind =
        stated === 'balance' ? ((difference ?? 0) > 0 ? 'transfer_in' : 'transfer_out') : stated;
      const draft = this.draft(row, ctx, kind, date, order);
      if (difference !== null) {
        draft.fields.quantity = Math.abs(difference);
      }
      const normalized = normalizeTrade(draft.fields);
      if ('error' in normalized) {
        results.push({ index, status: 'error', reason: RULE_REASONS[normalized.error] });
        continue;
      }
      const currency =
        draft.currency ?? found.currency ?? found.holding.priceCurrency ?? ctx.currency;
      if (found.currency && found.currency !== currency) {
        results.push({ index, status: 'error', reason: 'currency' });
        continue;
      }
      // The same sheet again: a row that is a trade already stored is skipped.
      const twin = found.events
        .slice(0, found.stored)
        .find(stored => !found.matched.has(stored.id) && sameTrade(stored, normalized));
      if (twin) {
        found.matched.add(twin.id);
        results.push({ index, status: 'skipped', reason: 'duplicate' });
        continue;
      }
      const event: TradeEvent = { ...normalized, id: `row-${index}` };
      try {
        replayTrades([...found.events, event], 'fifo');
      } catch (error) {
        if (!(error instanceof TradeReplayError)) throw error;
        results.push({ index, status: 'error', reason: 'exceeds_holding' });
        continue;
      }
      found.events.push(event);
      found.currency = currency;
      found.touched = true;
      if (dryRun) {
        results.push({ index, status: 'created' });
        continue;
      }
      const repo = ctx.manager.getRepository(InvestmentTrade);
      const saved = await repo.save(
        repo.create({
          workspaceId: ctx.workspaceId,
          holdingId: found.holding.id,
          kind: normalized.kind as InvestmentTradeKind,
          tradeDate: normalized.date,
          quantity: normalized.quantity,
          price: normalized.price,
          fee: normalized.fee,
          amount: normalized.amount,
          splitFrom: normalized.splitFrom,
          splitTo: normalized.splitTo,
          acquiredOn: normalized.acquiredOn,
          currency,
          note: ctx.cell(row, 'note').trim().slice(0, 500) || null,
          // One transaction gives every row the same now(); this keeps the sheet's order.
          createdAt: new Date(base + index),
        }),
      );
      ctx.created.push({ kind: 'investment_trade', id: saved.id });
      results.push({ index, status: 'created', id: saved.id });
    }

    if (!dryRun) {
      await this.settle(ctx, books);
    }
    return results;
  }

  /** The holding a row names, its book opened on first use; or why there is none. */
  private async book(
    row: string[],
    ctx: ImportContext,
    holdings: InvestmentHolding[],
    books: Map<string, Book>,
    dryRun: boolean,
  ): Promise<Book | string> {
    const key = bookKey(row, ctx);
    if (!key) return 'holding';
    const rawSymbol = ctx.cell(row, 'symbol').trim();
    const symbol = rawSymbol ? normalizeStockSymbol(rawSymbol) : '';
    const name = ctx.cell(row, 'name').trim();
    const open = books.get(key);
    if (open) return open;

    const matches = symbol
      ? bySymbol(holdings, rawSymbol, symbol)
      : holdings.filter(holding => nameKey(holding.name) === nameKey(name));
    if (matches.length > 1) return 'holding_ambiguous';
    let holding = matches[0];
    let isNew = false;
    if (!holding) {
      if (!(ctx.createMissingHoldings && ctx.investmentAccountId)) return 'holding_not_found';
      const repo = ctx.manager.getRepository(InvestmentHolding);
      const assetClass =
        (resolveEnumAlias(
          'assetClass',
          ctx.cell(row, 'assetClass'),
        ) as InvestmentAssetClass | null) ?? InvestmentAssetClass.OTHER;
      const cash = assetClass === InvestmentAssetClass.CASH;
      holding = repo.create({
        workspaceId: ctx.workspaceId,
        accountId: ctx.investmentAccountId,
        symbol: symbol || null,
        name: name || symbol,
        assetClass,
        quantity: 0,
        // A unit of cash is worth one of its currency.
        price: cash ? 1 : 0,
        priceCurrency: (cash && normalizeCurrencyCode(ctx.cell(row, 'currency'))) || ctx.currency,
        priceSource: InvestmentPriceSource.MANUAL,
        pricedAt: null,
      });
      if (!dryRun) {
        holding = await repo.save(holding);
        ctx.created.push({ kind: 'investment_holding', id: holding.id });
      }
      isNew = true;
    } else if (!dryRun) {
      // Held until the import commits, so a trade entered meanwhile cannot oversell it.
      await ctx.manager.getRepository(InvestmentHolding).findOne({
        where: { id: holding.id, workspaceId: ctx.workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
    }
    const existing = isNew
      ? []
      : await ctx.manager.getRepository(InvestmentTrade).find({
          where: { workspaceId: ctx.workspaceId, holdingId: holding.id },
          order: ENTRY_ORDER,
        });
    const book: Book = {
      holding,
      isNew,
      events: existing.map(toTradeEvent),
      stored: existing.length,
      matched: new Set(),
      currency: existing[0]?.currency ?? null,
      touched: false,
    };
    books.set(key, book);
    return book;
  }

  private draft(
    row: string[],
    ctx: ImportContext,
    kind: TradeKind,
    date: string,
    order: ReturnType<typeof detectDateOrder>,
  ) {
    const number = (field: string) => parseImportNumber(ctx.cell(row, field));
    const quantity = Math.abs(number('quantity').value ?? 0);
    const price = number('price');
    const amount = number('amount');
    const fee = Math.abs(number('fee').value ?? 0);
    const ratio = parseRatio(ctx.cell(row, 'ratio'));
    const unitPrice =
      price.value !== null
        ? Math.abs(price.value)
        : amount.value !== null && quantity > 0 && kind !== 'dividend'
          ? Math.abs(amount.value) / quantity
          : 0;
    return {
      currency:
        normalizeCurrencyCode(ctx.cell(row, 'currency')) ?? price.currency ?? amount.currency,
      fields: {
        kind,
        date,
        quantity,
        price: unitPrice,
        fee,
        amount: kind === 'dividend' && amount.value !== null ? Math.abs(amount.value) : null,
        splitFrom: ratio?.from ?? null,
        splitTo: ratio?.to ?? null,
        acquiredOn: parseImportDate(ctx.cell(row, 'acquiredOn'), order),
      },
    };
  }

  /**
   * Each holding the rows changed takes the quantity its trades now give.
   * A holding that was there before is remembered as it was, so an undo can
   * put a typed-in quantity back.
   */
  private async settle(ctx: ImportContext, books: Map<string, Book>): Promise<void> {
    const repo = ctx.manager.getRepository(InvestmentHolding);
    for (const book of books.values()) {
      if (!book.touched) continue;
      const { holding } = book;
      // Dividends alone (a broker's income report) leave a typed-in quantity as it is.
      const quantity = countsUnits(book.events)
        ? replayTrades(book.events, 'fifo').quantity
        : holding.quantity;
      // A split after the holding's quote changes what one unit is worth, as for one entered by hand.
      const ratio =
        splitFactorSince(book.events.slice(0, book.stored), pricedOn(holding)) /
        splitFactorSince(book.events, pricedOn(holding));
      const price = Number(holding.price) * ratio;
      if (!book.isNew) {
        ctx.updated.push({
          kind: 'investment_holding',
          id: holding.id,
          // The quantity as typed, and by how much the import's splits moved the
          // price: an undo takes that back off whatever the price is by then,
          // keeping a quote or an edit made since.
          before: { quantity: holding.quantity, priceRatio: ratio },
        });
      }
      await repo.update({ id: holding.id, workspaceId: ctx.workspaceId }, { quantity, price });
    }
  }
}
