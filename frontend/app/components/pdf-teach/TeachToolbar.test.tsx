import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const offer = vi.hoisted(() => ({ dismissed: false }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('./TeachShareDialog', () => ({
  shareOfferDismissed: () => offer.dismissed,
  TeachShareDialog: ({ onClose }: { onClose: () => void }) => (
    <button type="button" data-testid="share-offer" onClick={onClose} />
  ),
}));

import { TeachToolbar } from './TeachToolbar';
import type { TeachSession } from './useTeachSession';

const session = (over: Partial<TeachSession> = {}): TeachSession => ({
  statementId: 'statement-1',
  words: [],
  textUnderText: false,
  regions: [],
  activeTag: 'date',
  setActiveTag: vi.fn(),
  armed: false,
  addRegion: vi.fn(),
  removeRegion: vi.fn(),
  missing: [],
  preview: null,
  reading: false,
  saving: false,
  save: vi.fn(async () => true),
  pageWidths: {},
  setPageWidth: vi.fn(),
  ...over,
});

const preview = {
  missing: [],
  transactions: 42,
  totalDebit: 5289.63,
  totalCredit: 6100,
  rowsByHand: true,
  checks: [{ code: 'balance_chain', passed: true }],
  rows: [],
};

describe('TeachToolbar', () => {
  beforeEach(() => router.push.mockClear());

  it('names what is still to mark and keeps saving off', () => {
    render(<TeachToolbar session={session({ missing: [['description']] })} onDone={vi.fn()} />);
    expect(screen.getByTestId('teach-toolbar').textContent).toContain('Description');
    expect(screen.getByRole('button', { name: /save/i })).toHaveProperty('disabled', true);
  });

  it('names the running balance tag as the tags do, while none is marked', () => {
    render(<TeachToolbar session={session({ preview: { ...preview, checks: [] } })} onDone={vi.fn()} />);
    expect(screen.getByTestId('teach-toolbar').textContent).toContain(
      'mark “Running balance” to check that the balances follow',
    );
  });

  it('offers to share the layout after saving, and closes after the offer', async () => {
    offer.dismissed = false;
    const onDone = vi.fn();
    render(<TeachToolbar session={session({ preview })} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    fireEvent.click(await screen.findByTestId('share-offer'));
    expect(onDone).toHaveBeenCalled();
  });

  it('shows how the file reads and saves, then closes', async () => {
    offer.dismissed = true;
    const marks = session({ preview });
    const onDone = vi.fn();
    render(<TeachToolbar session={marks} onDone={onDone} />);
    const status = screen.getByTestId('teach-toolbar').textContent ?? '';
    expect(status).toContain('42');
    expect(status).toContain('5,289.63');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(marks.save).toHaveBeenCalled();
  });

  it('says the file has text under its text instead of judging the columns', () => {
    const date = { tag: 'date' as const, page: 1, x0: 0, y0: 0, x1: 50, y1: 50 };
    render(
      <TeachToolbar
        session={session({ textUnderText: true, regions: [date] })}
        onDone={vi.fn()}
      />,
    );
    const warnings = [...document.querySelectorAll('.seneca-pdf-teach__warning')];
    expect(warnings.map(warning => warning.textContent)).toEqual([
      expect.stringContaining('old text under the visible text'),
    ]);
  });

  it('warns when a check fails, and takes a tag by its number key', () => {
    const marks = session({
      preview: { ...preview, checks: [{ code: 'balance_chain', passed: false, row: 7 }] },
    });
    render(<TeachToolbar session={marks} onDone={vi.fn()} />);
    expect(screen.getByTestId('teach-toolbar').textContent).toContain('7');
    expect(document.querySelector('.seneca-pdf-teach__warning')).not.toBeNull();
    fireEvent.keyDown(document.body, { key: '3' });
    expect(marks.setActiveTag).toHaveBeenCalledWith('debit');
  });

  it('says one line per kind of misplaced area, naming every tag in it', () => {
    const heading = { text: 'Northwind', page: 1, x: 40, y: 20, width: 60, height: 6 };
    const off = (tag: TeachSession['activeTag']) => ({
      tag,
      page: 1,
      x0: 30,
      y0: 10,
      x1: 110,
      y1: 40,
    });
    render(
      <TeachToolbar
        session={session({
          words: [{ ...heading, line: 0, opensDate: false }],
          regions: [off('date'), off('description'), off('amount')],
        })}
        onDone={vi.fn()}
      />,
    );
    const warnings = [...document.querySelectorAll('.seneca-pdf-teach__warning')];
    expect(warnings.map(warning => warning.textContent)).toEqual([
      'Date, Description, and Amount ± are not on a column of transactions: no line in their areas starts with a date',
    ]);
  });

  it('names a single misplaced tag in its own words', () => {
    const heading = { text: 'Northwind', page: 1, x: 40, y: 20, width: 60, height: 6 };
    const off = { tag: 'date' as const, page: 1, x0: 30, y0: 10, x1: 110, y1: 40 };
    render(
      <TeachToolbar
        session={session({ words: [{ ...heading, line: 0, opensDate: false }], regions: [off] })}
        onDone={vi.fn()}
      />,
    );
    const warnings = [...document.querySelectorAll('.seneca-pdf-teach__warning')];
    expect(warnings.map(warning => warning.textContent)).toEqual([
      '“Date” is not on a column of transactions: no line in the area starts with a date',
    ]);
  });

  it('offers the rows by hand only once complete marks read nothing, on a page that takes them', () => {
    const empty = { ...preview, transactions: 0, totalDebit: 0, totalCredit: 0 };
    const failed = { ...empty, checks: [{ code: 'printed_totals', passed: false }] };
    const wayOut = (over: Partial<TeachSession>) => {
      const { unmount } = render(<TeachToolbar session={session(over)} onDone={vi.fn()} />);
      const buttons = screen.queryAllByRole('button', { name: /by hand/i }).map(b => b.textContent);
      const text = screen.getByTestId('teach-toolbar').textContent ?? '';
      unmount();
      return { buttons, text };
    };
    // A failed check at no rows: only the way out, nothing to keep and correct.
    expect(wayOut({ preview: failed }).buttons).toEqual(['Enter the rows by hand']);
    // A statement whose page takes no rows by hand: the instruction alone.
    const elsewhere = wayOut({ preview: { ...empty, rowsByHand: false } });
    expect(elsewhere.buttons).toEqual([]);
    expect(elsewhere.text).toContain('No rows read with these marks');
    // While the marks are read again, or a tag is missing, an old empty reading says nothing.
    expect(wayOut({ preview: empty, reading: true }).buttons).toEqual([]);
    expect(wayOut({ preview: empty, missing: [['amount']] }).buttons).toEqual([]);
    expect(wayOut({ preview: empty, words: undefined }).buttons).toEqual([]);
  });

  it('at no rows says what to change and leaves for the rows by hand without saving', async () => {
    const marks = session({ preview: { ...preview, transactions: 0, totalDebit: 0, totalCredit: 0 } });
    const onDone = vi.fn();
    render(<TeachToolbar session={marks} onDone={onDone} />);
    const toolbar = screen.getByTestId('teach-toolbar');
    expect(toolbar.textContent).toContain('No rows read with these marks');
    expect(toolbar.textContent).not.toContain('Rows: 0');
    expect(screen.getByRole('button', { name: /save/i })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: /enter the rows by hand/i }));
    expect(router.push).toHaveBeenCalledWith('/statements/statement-1/edit');
    expect(onDone).toHaveBeenCalled();
    expect(marks.save).not.toHaveBeenCalled();
  });

  it('keeps what reads and opens the rows to correct by hand when no marking adds up', async () => {
    const marks = session({
      preview: { ...preview, checks: [{ code: 'printed_totals', passed: false }] },
    });
    const onDone = vi.fn();
    render(<TeachToolbar session={marks} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /by hand/i }));
    await vi.waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/statements/statement-1/edit'),
    );
    expect(marks.save).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });
});
