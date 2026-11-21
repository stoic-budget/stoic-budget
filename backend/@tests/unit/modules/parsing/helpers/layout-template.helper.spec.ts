import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import {
  labelledBalance,
  layoutReading,
  missingTags,
  readingScore,
  type TeachRegion,
  templateFits,
  templateFromRegions,
  templateSignature,
} from '@/modules/parsing/helpers/layout-template.helper';
import { readLayoutTable } from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** A word is [text, x]; width is 5pt per character, height 8pt. */
type Word = [string, number];

const row = (y: number, words: Word[], page = 1): PdfTextRow => ({
  page,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page })),
});

// Headings no built-in phrase knows: the reader finds no table without teaching.
const header = row(100, [
  ['When', 40],
  ['What', 120],
  ['Went', 300],
  ['Out', 322],
  ['Came', 375],
  ['In', 400],
  ['Left', 475],
]);
const rows = [
  row(60, [['Brought', 40], ['forward', 80], ['1,000.00', 200]]),
  header,
  row(120, [['01-02-2025', 40], ['ACME', 120], ['Store', 145], ['12.50', 317], ['987.50', 470]]),
  row(140, [['03-02-2025', 40], ['Member', 120], ['One', 155], ['100.00', 382], ['1,087.50', 460]]),
  row(160, [['Page', 40], ['of', 65], ['statement', 80]]),
];

// Amounts end at 342 (out), 412 (in) and 500 (left).
const regions: TeachRegion[] = [
  { tag: 'date', page: 1, x0: 38, y0: 118, x1: 100, y1: 150 },
  { tag: 'description', page: 1, x0: 115, y0: 118, x1: 280, y1: 150 },
  { tag: 'debit', page: 1, x0: 295, y0: 118, x1: 350, y1: 150 },
  { tag: 'credit', page: 1, x0: 370, y0: 118, x1: 420, y1: 150 },
  { tag: 'balance', page: 1, x0: 450, y0: 118, x1: 505, y1: 150 },
  { tag: 'skip', page: 1, x0: 30, y0: 158, x1: 200, y1: 170 },
  { tag: 'openingBalance', page: 1, x0: 195, y0: 58, x1: 250, y1: 70 },
];

describe('layout-template.helper', () => {
  it('reads no table from headings it does not know', () => {
    expect(readLayoutTable(rows).transactions).toEqual([]);
  });

  it('learns the headings above the marked cells and reads the table with them', () => {
    const template = templateFromRegions(regions, rows);
    expect(template.headings).toEqual([
      { phrase: 'when', role: 'date' },
      { phrase: 'what', role: 'description' },
      { phrase: 'went out', role: 'debit' },
      { phrase: 'came in', role: 'credit' },
      { phrase: 'left', role: 'balance' },
    ]);
    const read = readLayoutTable(rows, layoutReading(template)).transactions;
    expect(read.map(t => [t.dateText, t.description, t.debit, t.credit, t.balance])).toEqual([
      ['01-02-2025', 'ACME Store', 12.5, undefined, 987.5],
      ['03-02-2025', 'Member One', undefined, 100, 1087.5],
    ]);
    expect(read.map(t => t.at)).toEqual([
      { page: 1, y: 120 },
      { page: 1, y: 140 },
    ]);
  });

  it('learns the header line the user marked', () => {
    const template = templateFromRegions(
      [...regions, { tag: 'header', page: 1, x0: 30, y0: 98, x1: 510, y1: 110 }],
      rows,
    );
    expect(template.headings.map(heading => heading.phrase)).toEqual([
      'when',
      'what',
      'went out',
      'came in',
      'left',
    ]);
  });

  it('keeps no figure or description of the rows', () => {
    const kept = JSON.stringify(templateFromRegions(regions, rows)).toLowerCase();
    for (const secret of ['12.50', '987', 'acme', 'member', '1,000']) {
      expect(kept).not.toContain(secret);
    }
  });

  it('reads a table printed without a header by the taught columns', () => {
    const template = templateFromRegions(regions, rows);
    const headless = rows.filter(line => line !== header);
    expect(readLayoutTable(headless).transactions).toEqual([]);
    const read = readLayoutTable(headless, layoutReading(template)).transactions;
    expect(read.map(t => [t.debit, t.credit, t.balance])).toEqual([
      [12.5, undefined, 987.5],
      [undefined, 100, 1087.5],
    ]);
  });

  it('keeps the taught columns under a section heading', () => {
    const template = templateFromRegions(regions, rows);
    const sectioned = [
      row(110, [['Withdrawals', 40]]),
      row(120, [['01-02-2025', 40], ['ACME', 120], ['Store', 145], ['12.50', 317], ['987.50', 470]]),
    ];
    const [read] = readLayoutTable(sectioned, layoutReading(template)).transactions;
    expect([read.debit, read.balance]).toEqual([12.5, 987.5]);
  });

  it('places a money column by its figures, however wide the area is drawn', () => {
    const wide = regions.map(region =>
      region.tag === 'debit' ? { ...region, x1: region.x1 + 30 } : region,
    );
    const template = templateFromRegions(wide, rows);
    expect(template.columns.find(column => column.role === 'debit')?.x1).toBe(342);
    const headless = rows.filter(line => line !== header);
    const read = readLayoutTable(headless, layoutReading(template)).transactions;
    expect(read.map(t => [t.debit, t.credit])).toEqual([
      [12.5, undefined],
      [undefined, 100],
    ]);
  });

  it('spans a column marked in several areas, one per page, and keeps one of each heading', () => {
    const nextPage = rows.map(line => ({
      ...line,
      page: 2,
      items: line.items.map(item => ({ ...item, page: 2, x: item.x - 6 })),
    }));
    const marked = [
      ...regions,
      ...regions
        .filter(region => region.tag !== 'skip' && region.tag !== 'openingBalance')
        .map(region => ({ ...region, page: 2, x0: region.x0 - 6, x1: region.x1 - 6 })),
    ];
    const template = templateFromRegions(marked, [...rows, ...nextPage]);
    expect(template.columns.map(column => column.role)).toEqual([
      'date',
      'description',
      'debit',
      'credit',
      'balance',
    ]);
    expect(template.columns[0]).toMatchObject({ x0: 32, x1: 100 });
    expect(template.headings.filter(heading => heading.role === 'date')).toHaveLength(1);
  });

  it('takes a date printed in two words for a transaction row', () => {
    const dayMonth = [
      header,
      row(120, [['02', 40], ['Sep', 52], ['ACME', 120], ['Store', 145], ['12.50', 317], ['987.50', 470]]),
      row(140, [['03', 40], ['Sep', 52], ['Member', 120], ['One', 155], ['100.00', 382], ['1,087.50', 460]]),
    ];
    const template = templateFromRegions(regions, dayMonth);
    expect(template.columns.map(column => column.role)).toEqual([
      'date',
      'description',
      'debit',
      'credit',
      'balance',
    ]);
  });

  it('takes a date printed right of the description for a transaction row', () => {
    const dateRight = [
      row(60, [['Brought', 40], ['forward', 80], ['1,000.00', 200]]),
      row(100, [['What', 40], ['When', 200], ['Went', 300], ['Out', 322], ['Came', 375], ['In', 400], ['Left', 475]]),
      row(120, [['ACME', 40], ['Store', 65], ['02', 200], ['Sep', 212], ['12.50', 317], ['987.50', 470]]),
      row(140, [['Member', 40], ['One', 75], ['03', 200], ['Sep', 212], ['100.00', 382], ['1,087.50', 460]]),
    ];
    const marked: TeachRegion[] = [
      { tag: 'description', page: 1, x0: 35, y0: 118, x1: 180, y1: 150 },
      { tag: 'date', page: 1, x0: 195, y0: 118, x1: 240, y1: 150 },
      ...regions.filter(region => ['debit', 'credit', 'balance'].includes(region.tag)),
      { tag: 'openingBalance', page: 1, x0: 195, y0: 58, x1: 250, y1: 70 },
    ];
    const template = templateFromRegions(marked, dateRight);
    expect(template.columns.map(column => column.role)).toEqual([
      'description',
      'date',
      'debit',
      'credit',
      'balance',
    ]);
    expect(template.balances.start).toBe('brought forward');
    const read = readLayoutTable(dateRight, layoutReading(template)).transactions;
    expect(read.map(t => [t.dateText, t.description, t.debit, t.credit, t.balance])).toEqual([
      ['02 Sep', 'ACME Store', 12.5, undefined, 987.5],
      ['03 Sep', 'Member One', undefined, 100, 1087.5],
    ]);
    // Without a Date area over the dates, no line is a transaction row and no column is learnt.
    const misplaced = marked.map(region =>
      region.tag === 'date' ? { ...region, x0: 35, x1: 100 } : region,
    );
    expect(templateFromRegions(misplaced, dateRight).columns).toEqual([]);
  });

  it('takes a date under the Date area only on its own lines, right of the description', () => {
    const column = (role: string, x0: number, x1: number) => expect.objectContaining({ role, x0, x1 });
    // A line that starts with a date is a transaction row with no Date area at all.
    const descriptionOnly = templateFromRegions(
      [{ tag: 'description', page: 1, x0: 115, y0: 118, x1: 180, y1: 150 }],
      rows,
    );
    expect(descriptionOnly.columns).toEqual([column('description', 115, 180)]);
    // A Date area over a date in a summary line, with no description left of it, is no column.
    const period = row(40, [['Period', 40], ['01-10-2025', 120], ['to', 180], ['31-10-2025', 200]]);
    const overPeriod: TeachRegion = { tag: 'date', page: 1, x0: 115, y0: 38, x1: 175, y1: 50 };
    expect(templateFromRegions([overPeriod], [period, ...rows]).columns).toEqual([]);
    // A date right of the text counts on the lines the Date area covers, not on a heading above.
    const transactions = [
      row(120, [['ACME', 40], ['Store', 65], ['02', 200], ['Sep', 212], ['12.50', 317]]),
      row(140, [['Member', 40], ['One', 75], ['03', 200], ['Sep', 212], ['100.00', 382]]),
    ];
    const heading = row(40, [['Period', 40], ['01', 75], ['Oct', 90], ['to', 110], ['31', 200], ['Oct', 212]]);
    const date: TeachRegion = { tag: 'date', page: 1, x0: 195, y0: 118, x1: 240, y1: 150 };
    const overHeading: TeachRegion = { tag: 'description', page: 1, x0: 35, y0: 38, x1: 150, y1: 50 };
    expect(templateFromRegions([overHeading, date], [heading, ...transactions]).columns).toEqual([
      column('date', 195, 240),
    ]);
    // A description word reaching into the Date area comes first under it: no date opens there.
    const reaching = [row(120, [['ACME', 40], ['Storefront', 150], ['02', 205], ['Sep', 217]])];
    const description: TeachRegion = { ...date, tag: 'description', x0: 35, x1: 190 };
    expect(templateFromRegions([description, date], reaching).columns).toEqual([]);
  });

  it('leaves out lines like the one marked to skip', () => {
    const template = templateFromRegions(regions, rows);
    expect(template.skip).toEqual(['page of statement']);
    const footerUnderRow = [
      ...rows.slice(0, 3),
      row(129, [['Page', 120], ['of', 145], ['statement', 160]]),
    ];
    const withSkip = readLayoutTable(footerUnderRow, layoutReading(template)).transactions;
    expect(withSkip[0].description).toBe('ACME Store');
    const { skip: _skip, ...noSkip } = layoutReading(template);
    expect(readLayoutTable(footerUnderRow, noSkip).transactions[0].description).toBe(
      'ACME Store Page of statement',
    );
  });

  it('reads the opening balance beside its taught label', () => {
    const template = templateFromRegions(regions, rows);
    expect(template.balances).toEqual({ start: 'brought forward', end: undefined });
    expect(labelledBalance(rows, template.balances.start)).toBe(1000);
    expect(labelledBalance(rows, 'carried forward')).toBeNull();
  });

  it('takes the label the user drew around with the figure, and never a line far above', () => {
    const page = [
      row(40, [['Account', 40], ['statement', 80], ['01-02-2025', 140], ['to', 200], ['28-02-2025', 215]]),
      row(60, [['Brought', 40], ['forward', 80], ['1,000.00', 200]]),
      row(64, [['Carried', 300], ['forward', 340]]),
    ];
    const whole = { tag: 'openingBalance' as const, page: 1, x0: 35, y0: 56, x1: 260, y1: 70 };
    expect(templateFromRegions([whole], page).balances.start).toBe('brought forward');
    // The figure alone, with nothing before it on its line: the period line far above is no label.
    const lone = [row(40, page[0].items.map(item => [item.text, item.x] as [string, number])), row(60, [['1,000.00', 200]])];
    const figure = { tag: 'openingBalance' as const, page: 1, x0: 195, y0: 56, x1: 260, y1: 70 };
    expect(templateFromRegions([figure], lone).balances.start).toBeUndefined();
    // A label printed right over its figure still counts.
    const stacked = [row(50, [['Opening', 190], ['balance', 225]]), row(60, [['1,000.00', 200]])];
    expect(templateFromRegions([figure], stacked).balances.start).toBe('opening balance');
  });

  it('a renamed heading is matched before the built-in one', () => {
    // "Debit" is a built-in heading for money out; this bank prints money in under it.
    const swapped = [
      row(100, [['Date', 40], ['Details', 120], ['Debit', 380], ['Balance', 460]]),
      row(120, [['01-02-2025', 40], ['Refund', 120], ['20.00', 380], ['20.00', 465]]),
    ];
    expect(readLayoutTable(swapped).transactions[0].debit).toBe(20);
    const template = templateFromRegions(
      [
        { tag: 'date', page: 1, x0: 38, y0: 118, x1: 100, y1: 130 },
        { tag: 'description', page: 1, x0: 115, y0: 118, x1: 300, y1: 130 },
        { tag: 'credit', page: 1, x0: 370, y0: 118, x1: 410, y1: 130 },
        { tag: 'balance', page: 1, x0: 450, y0: 118, x1: 500, y1: 130 },
      ],
      swapped,
    );
    expect(readLayoutTable(swapped, layoutReading(template)).transactions[0].credit).toBe(20);
  });

  it('learns nothing wrong from tags put on the wrong things', () => {
    // As a user first marked it: the bank's name as the header, the period line
    // as a date, the opening balance line as the balance column, the balance
    // column as the closing balance, and the date column twice.
    const page = [
      row(20, [['Northwind', 40], ['Mutual', 100]]),
      row(40, [['Account', 40], ['statement', 80], ['01-02-2025', 140], ['to', 200], ['28-02-2025', 215]]),
      ...rows,
    ];
    const marked: TeachRegion[] = [
      { tag: 'header', page: 1, x0: 35, y0: 15, x1: 140, y1: 30 },
      { tag: 'bankName', page: 1, x0: 35, y0: 15, x1: 140, y1: 30 },
      { tag: 'date', page: 1, x0: 35, y0: 38, x1: 270, y1: 50 },
      { tag: 'balance', page: 1, x0: 35, y0: 58, x1: 260, y1: 70 },
      ...regions.filter(region => region.tag === 'date'),
      ...regions.filter(region => ['description', 'debit', 'credit'].includes(region.tag)),
      { tag: 'closingBalance', page: 1, x0: 450, y0: 118, x1: 505, y1: 150 },
    ];
    const template = templateFromRegions(marked, page);
    expect(template.headings.map(heading => heading.phrase)).toEqual([
      'when',
      'what',
      'went out',
      'came in',
    ]);
    expect(template.columns.map(column => column.role)).toEqual(['date', 'description', 'debit', 'credit']);
    expect(template.balances).toEqual({ start: undefined, end: undefined });
    expect(template.institution).toBe('Northwind Mutual');
    expect(JSON.stringify(template).toLowerCase()).not.toMatch(/acme|member|rent/);

    // The unmarked balance column is no part of the description.
    const headless = page.filter(line => line !== header);
    const read = readLayoutTable(headless, layoutReading(template)).transactions;
    expect(read.map(t => t.description)).toEqual(['ACME Store', 'Member One']);
  });

  it('keeps an unmarked column right of the money out of the description', () => {
    // The balance column is left unmarked: its figures start left of its heading "Left".
    const template = templateFromRegions(
      regions.filter(region => region.tag !== 'balance'),
      rows,
    );
    const read = readLayoutTable(rows, layoutReading(template)).transactions;
    expect(read.map(t => t.description)).toEqual(['ACME Store', 'Member One']);
  });

  it('names the tags still missing', () => {
    expect(missingTags(regions)).toEqual([]);
    expect(missingTags([{ tag: 'description', page: 1, x0: 0, y0: 0, x1: 1, y1: 1 }])).toEqual([
      'date',
      'debit|credit|amount',
    ]);
  });

  it('fits text that prints its headings, and signs a layout by headings alone', () => {
    const template = templateFromRegions(regions, rows);
    expect(templateFits(template, 'WHEN  WHAT\nWENT OUT')).toBe(true);
    // Headings count as whole words: "Somewhat" and "Whenever" are no "What" and "When".
    expect(templateFits(template, 'Somewhat Whenever Description Amount')).toBe(false);
    // One heading alone is any statement with a "Left" in it.
    expect(templateFits(template, 'Left to pay')).toBe(false);
    const elsewhere = templateFromRegions(
      regions.map(region => ({ ...region, x0: region.x0 + 1 })),
      rows,
    );
    expect(templateSignature(elsewhere)).toBe(templateSignature(template));
  });

  it('scores a reading by its rows and the checks a changed layout breaks', () => {
    const transactions = [{}] as never[];
    expect(readingScore({ transactions: [] })).toBe(0);
    expect(
      readingScore({ transactions, checks: [{ code: 'balance_chain', passed: false }] }),
    ).toBe(1);
    expect(
      readingScore({ transactions, checks: [{ code: 'dates_in_period', passed: false }] }),
    ).toBe(2);
    expect(readingScore({ transactions, checks: [{ code: 'printed_totals', passed: true }] })).toBe(
      2,
    );
  });
});
