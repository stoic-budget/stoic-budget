import { parseClosesCsv, readNumber } from '@/modules/investments/closes-csv';

const TODAY = '2026-03-10';

describe('parseClosesCsv', () => {
  it('reads the close of a Yahoo-style download, never the adjusted one', () => {
    const csv = [
      'Date,Open,High,Low,Close,Adj Close,Volume',
      '2026-03-02,10,11,9,10.5,9.9,1000',
      '2026-03-03,10.5,12,10,11.25,10.6,1200',
    ].join('\n');

    expect(parseClosesCsv(csv, TODAY)).toEqual({
      rows: [
        { line: 2, date: '2026-03-02', close: 10.5 },
        { line: 3, date: '2026-03-03', close: 11.25 },
      ],
      skipped: [],
    });
  });

  it('reads a headerless file as date then close', () => {
    const parsed = parseClosesCsv('2026-03-02,10.5\r\n2026-03-03,11\r\n', TODAY);

    expect(parsed.rows.map(row => [row.line, row.date, row.close])).toEqual([
      [1, '2026-03-02', 10.5],
      [2, '2026-03-03', 11],
    ]);
  });

  it('reads semicolons with decimal commas and day-first dates', () => {
    const csv = ['Datum;Schlusskurs', '02.03.2026;1.234,56', '13.03.2025;"99,5"'].join('\n');

    expect(parseClosesCsv(csv, TODAY).rows).toEqual([
      { line: 2, date: '2026-03-02', close: 1234.56 },
      { line: 3, date: '2025-03-13', close: 99.5 },
    ]);
  });

  it('settles month-first dates from the column', () => {
    const csv = ['date,price', '03/02/2026,10', '02/27/2026,9'].join('\n');

    expect(parseClosesCsv(csv, TODAY).rows.map(row => row.date)).toEqual(['2026-03-02', '2026-02-27']);
  });

  it('says which lines it left out and why', () => {
    const csv = [
      'Date,Close',
      'yesterday,10',
      '2026-03-02,n/a',
      '2026-03-02,0.000000001',
      '2026-03-11,10',
      '2026-03-03,10',
      '2026-03-03,11',
    ].join('\n');

    const parsed = parseClosesCsv(csv, TODAY);

    expect(parsed.rows).toEqual([{ line: 6, date: '2026-03-03', close: 10 }]);
    expect(parsed.skipped).toEqual([
      { line: 2, reason: 'unreadable_date' },
      { line: 3, reason: 'unreadable_close' },
      { line: 4, reason: 'unreadable_close' },
      { line: 5, reason: 'future_date' },
      { line: 7, reason: 'duplicate_date' },
    ]);
  });

  it('has nothing for an empty file', () => {
    expect(parseClosesCsv('\n\n', TODAY)).toEqual({ rows: [], skipped: [] });
  });
});

describe('readNumber', () => {
  it.each([
    ['1.234,56', ';', 1234.56],
    ['1,234.56', ',', 1234.56],
    ['99,5', ';', 99.5],
    ['99,5', ',', 99.5],
    ['1,234', ',', 1234],
    ['1,234', ';', 1.234],
    ['$ 12.50', ',', 12.5],
    ['1.2.3', ',', null],
    ['—', ',', null],
  ])('reads %s (separator %s) as %s', (raw, delimiter, expected) => {
    expect(readNumber(raw, delimiter)).toBe(expected);
  });
});
