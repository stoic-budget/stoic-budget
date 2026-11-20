import { appDefaultCurrency } from '../../../common/utils/currency.util';
import {
  extractTablesFromPdf,
  extractTextAndLayoutFromPdf,
  extractTextFromPdf,
  type PdfTextRow,
} from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import { contributedHeadings } from '../helpers/contributed-layouts';
import { findAccountNumberInColumn } from '../helpers/pdf-layout-account-number.helper';
import { withCreditMarks } from '../helpers/pdf-layout-credit-marks.helper';
import { statementLayout } from '../helpers/pdf-layout-fingerprint.helper';
import type { RowRule } from '../helpers/pdf-layout-row-date.helper';
import { pickByChecks, ROW_RULES } from '../helpers/pdf-layout-rules.helper';
import {
  type LayoutReading,
  type LayoutTransaction,
  readLayoutTable,
  readLayoutTransactions,
} from '../helpers/pdf-layout-table.helper';
import {
  openingBalanceFromRows,
  splitByAccount,
  toParsedTransactions,
} from '../helpers/pdf-layout-transactions.helper';
import {
  mapPdfTableRowsToTransactions,
  pickReconciledTransactions,
} from '../helpers/pdf-table.helper';
import {
  accountStatements,
  accountTexts,
  plausiblePeriod,
} from '../helpers/statement-accounts.helper';
import {
  checkBalanceChain,
  checkDatesInPeriod,
  checkPrintedBalances,
  checkPrintedTotals,
  checkSectionTotals,
} from '../helpers/statement-checks.helper';
import {
  detectNumericDateOrder,
  type NumericDateOrder,
  orderWithinPeriod,
} from '../helpers/statement-date.helper';
import { findHeaderPeriod } from '../helpers/statement-header-period.helper';
import {
  detectStatementCurrency,
  findAccountNumber,
  findBalanceRowPeriod,
  findStatementAnchor,
  findStatementBalances,
  findStatementTotals,
  isCreditCardStatement,
} from '../helpers/statement-metadata.helper';
import type {
  ParseCheck,
  ParsedStatement,
  ParsedTransaction,
} from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';

const negate = (value: number | null) => (value === null ? null : -value);

export class GenericPdfParser extends BaseParser {
  /** How the table is read: the built-in headings, or a workspace's taught layout on top. */
  protected reading: LayoutReading = {};

  async canParse(
    bankName: BankName,
    fileType: FileType,
    _filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    const cachedTextLength = cachedText?.length ?? 0;
    return bankName === BankName.OTHER && fileType === FileType.PDF && cachedTextLength >= 0;
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const { text, rowSets, layoutRows } = await this.extract(filePath, cachedText);

    const headerInfo = this.extractHeaderFromText(text);
    const localeInfo = this.detectLocale(text);
    const detectedCurrency = detectStatementCurrency(text) || appDefaultCurrency();

    const reading = this.readingFor(text);
    const layoutTransactions = this.checkedReading(layoutRows, reading, text);
    // The generic reading of the same rows: its sections' totals and the layout's words.
    const table = readLayoutTable(layoutRows, reading);
    const layout = statementLayout(table.layout, text);
    // Row dates decide first; in free text only dates with a year count, since
    // "38.2gal" or "19.5%" look like day-first dates too.
    const dateOrder =
      detectNumericDateOrder(layoutTransactions.map(t => t.dateText)) ??
      detectNumericDateOrder(text.match(/\b\d{1,2}([./-])\d{1,2}\1\d{2,4}\b/g) ?? []) ??
      orderWithinPeriod(
        layoutTransactions.map(t => t.dateText),
        findHeaderPeriod(text, 'dmy'),
      ) ??
      'dmy';
    const latestPrinted = findStatementAnchor(text, dateOrder);
    const isCard = isCreditCardStatement(text);

    const accounts = splitByAccount(layoutTransactions);
    if (accounts.length > 1) {
      const [first, ...others] = accountStatements(accounts, {
        text,
        texts: accountTexts(layoutRows),
        dateOrder,
        latestPrinted,
        currency: detectedCurrency,
        isCard,
      });
      return { ...first, otherAccounts: others, layout };
    }

    const { balanceStart, balanceEnd } = this.readBalances(
      text,
      layoutTransactions,
      dateOrder,
      isCard,
    );

    // The layout reading comes first: on statements without ruling lines the
    // table attempts read page-wide noise, and on Russian-headed tables it
    // finds nothing and steps aside.
    const layoutParsed = toParsedTransactions(
      layoutTransactions,
      dateOrder,
      latestPrinted,
      detectedCurrency,
      isCard,
    );
    const transactions = pickReconciledTransactions(
      [
        layoutParsed,
        ...rowSets.map(rows =>
          mapPdfTableRowsToTransactions(rows, {
            defaultCurrency: detectedCurrency,
            stopWords: ['итого', 'оборот', 'остаток'],
          }),
        ),
      ],
      balanceStart,
      balanceEnd,
    );

    const legacyRange = this.extractDateRange(text);
    // Else the dated balance rows: "Beginning Balance on December 16, 2020" opens it.
    const dateRange = plausiblePeriod(
      legacyRange.from
        ? legacyRange
        : (findHeaderPeriod(text, dateOrder) ?? findBalanceRowPeriod(text, dateOrder)),
      transactions,
    );
    const transactionDates = transactions.map(t => t.transactionDate).filter(Boolean);
    const minDate =
      transactionDates.length > 0
        ? new Date(Math.min(...transactionDates.map(d => d.getTime())))
        : null;
    const maxDate =
      transactionDates.length > 0
        ? new Date(Math.max(...transactionDates.map(d => d.getTime())))
        : null;
    const dateFrom = dateRange?.from || minDate || new Date();
    const dateTo = dateRange?.to || maxDate || dateFrom;

    return {
      metadata: {
        accountNumber:
          this.extractAccountNumber(text) ||
          findAccountNumber(text) ||
          findAccountNumberInColumn(layoutRows) ||
          '',
        currency: detectedCurrency,
        dateFrom,
        dateTo,
        balanceStart: balanceStart ?? undefined,
        balanceEnd: balanceEnd ?? undefined,
        rawHeader: headerInfo.rawHeader,
        normalizedHeader: headerInfo.normalizedHeader,
        locale: localeInfo.locale !== 'unknown' ? localeInfo.locale : undefined,
      },
      transactions,
      checks: this.readingChecks(text, dateOrder, transactions, dateRange, isCard, {
        rows: transactions === layoutParsed ? layoutTransactions : [],
        sections: table.sections,
      }),
      layout,
    };
  }

  /**
   * What this reading is held to: the printed running balances, sections'
   * totals, money in and out, labelled balances and period (see
   * statement-checks.helper). The rows' own checks apply only when the
   * layout reading is the one kept.
   */
  private readingChecks(
    text: string,
    dateOrder: NumericDateOrder,
    transactions: ParsedTransaction[],
    period: { from: Date | null; to: Date | null } | null,
    isCard: boolean,
    layout: { rows: LayoutTransaction[]; sections: Parameters<typeof checkSectionTotals>[0] },
  ): ParseCheck[] {
    const rows = layout.rows;
    const fromRows = {
      start: openingBalanceFromRows(rows),
      end: rows[rows.length - 1]?.balance ?? null,
    };
    return [
      checkBalanceChain(rows, isCard),
      rows.length > 0 ? checkSectionTotals(layout.sections) : null,
      checkPrintedTotals(findStatementTotals(text, dateOrder), transactions),
      checkPrintedBalances(findStatementBalances(text, dateOrder), fromRows),
      checkDatesInPeriod(
        transactions,
        period?.from && period.to ? { from: period.from, to: period.to } : null,
      ),
    ].filter((check): check is ParseCheck => check !== null);
  }

  /** The table's rows, which a bank's own parser may read further. */
  protected readTransactions(
    rows: PdfTextRow[],
    reading: LayoutReading = this.reading,
  ): LayoutTransaction[] {
    return withCreditMarks(rows, readLayoutTransactions(rows, { ...reading, rows: this.rowRule }));
  }

  /** The row rule `readTransactions` reads under; a bank's override passes no reading. */
  private rowRule: RowRule = 'dated';

  /**
   * The table read under each row rule, keeping the reading the statement's
   * printed balances and totals agree with (pdf-layout-rules.helper).
   */
  private checkedReading(rows: PdfTextRow[], reading: LayoutReading, text: string) {
    try {
      const readings = ROW_RULES.map(rule => {
        this.rowRule = rule;
        return this.readTransactions(rows, reading);
      });
      return pickByChecks(readings, text);
    } finally {
      this.rowRule = 'dated';
    }
  }

  /** A workspace's taught layout, or else the headings contributed for the bank the file names. */
  private readingFor(text: string): LayoutReading {
    if (this.reading.headings || this.reading.columns) {
      return this.reading;
    }
    const headings = contributedHeadings(text);
    return headings ? { headings } : this.reading;
  }

  private async extract(filePath: string, cachedText?: string) {
    let text = '';
    let rowSets: string[][][] = [];
    let layoutRows: PdfTextRow[] = [];

    try {
      text = cachedText ?? (await extractTextFromPdf(filePath));
    } catch (error) {
      this.logger.warn('Failed to extract PDF text:', (error as Error)?.message);
    }

    try {
      const extracted = await extractTablesFromPdf(filePath);
      rowSets = extracted.rowSets;
    } catch (error) {
      this.logger.warn('Failed to extract PDF tables:', (error as Error)?.message);
    }

    try {
      layoutRows = (await extractTextAndLayoutFromPdf(filePath)).rows;
    } catch (error) {
      this.logger.warn('Failed to extract PDF layout:', (error as Error)?.message);
    }

    return { text, rowSets, layoutRows };
  }

  /**
   * Russian labels first, as before; then the running balance column, which
   * is exact; then labels in other languages. A card's printed balance is what
   * is owed: a debt, so below zero.
   */
  private readBalances(
    text: string,
    layoutTransactions: LayoutTransaction[],
    dateOrder: NumericDateOrder,
    isCard: boolean,
  ) {
    const printed = findStatementBalances(text, dateOrder);
    const labelled = isCard ? { start: negate(printed.start), end: negate(printed.end) } : printed;
    const balanceStart =
      this.extractBalance(text, 'Остаток на начало') ??
      this.extractBalance(text, 'Остаток на начало периода') ??
      this.extractBalance(text, 'Входящий остаток') ??
      openingBalanceFromRows(layoutTransactions) ??
      labelled.start;
    const balanceEnd =
      this.extractBalance(text, 'Остаток на конец') ??
      this.extractBalance(text, 'Остаток на конец периода') ??
      this.extractBalance(text, 'Исходящий остаток') ??
      layoutTransactions[layoutTransactions.length - 1]?.balance ??
      labelled.end;
    return { balanceStart, balanceEnd };
  }
}
