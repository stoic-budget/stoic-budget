import type { CustomTableColumn } from '@/entities/custom-table-column.entity';
import type { CustomTableRow } from '@/entities/custom-table-row.entity';
import { applyFormulaColumns } from '@/modules/custom-tables/helpers/row-data';

const columns = [
  { key: 'amount', type: 'number', config: null },
  { key: 'total', type: 'formula', config: { expression: 'SUM([amount])' } },
  { key: 'running', type: 'formula', config: { expression: 'RUNNING_SUM([amount])' } },
  { key: 'doubled', type: 'formula', config: { expression: '[amount]*2' } },
  { key: 'plus', type: 'formula', config: { expression: '[total]+1' } },
] as unknown as CustomTableColumn[];

describe('applyFormulaColumns before the recalculation reached a row', () => {
  it('leaves table-wide formulas empty and works out the row-only ones', () => {
    const row = { data: { amount: 10 }, computed: {} } as unknown as CustomTableRow;

    applyFormulaColumns([row], columns);

    expect(row.data).toMatchObject({ total: null, running: null, doubled: 20, plus: null });
  });

  it('uses the recalculated values once they are there', () => {
    const row = {
      data: { amount: 10 },
      computed: { total: 610, running: 600, doubled: 20, plus: 611 },
    } as unknown as CustomTableRow;

    applyFormulaColumns([row], columns);

    expect(row.data).toMatchObject({ total: 610, running: 600, doubled: 20, plus: 611 });
  });
});
