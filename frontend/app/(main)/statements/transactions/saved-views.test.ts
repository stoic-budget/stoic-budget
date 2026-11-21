import { describe, expect, it } from 'vitest';
import {
  addView,
  MAX_SAVED_VIEWS,
  readTransactionsPreference,
  removeView,
  renameView,
  type SavedView,
  viewFilters,
} from './saved-views';
import { EMPTY_FILTERS } from './transaction-filters';

const coffee = { ...EMPTY_FILTERS, q: 'ACME Coffee', noPayee: true };

describe('readTransactionsPreference', () => {
  it('keeps the other keys of the scope and narrows the saved views', () => {
    const read = readTransactionsPreference({
      owner: 'me',
      savedViews: [
        { id: 'a', name: 'Coffee', filters: 'q=ACME' },
        { id: 'b', name: '  ', filters: '' },
        { id: 3, name: 'Broken', filters: '' },
        'junk',
      ],
    });
    expect(read).toEqual({ owner: 'me', savedViews: [{ id: 'a', name: 'Coffee', filters: 'q=ACME' }] });
  });

  it('starts with no views when the scope stores none', () => {
    expect(readTransactionsPreference({ owner: 'shared' }).savedViews).toEqual([]);
  });
});

describe('saved view list', () => {
  it('saves filters under a name and gives them back', () => {
    const [view] = addView([], '  Coffee  ', coffee);
    expect(view.name).toBe('Coffee');
    expect(viewFilters(view)).toEqual(coffee);
  });

  it('overwrites the filters of a view with the same name, any case', () => {
    const views = addView([], 'Coffee', coffee);
    const next = addView(views, 'coffee', { ...EMPTY_FILTERS, untagged: true });
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(views[0].id);
    expect(viewFilters(next[0])).toEqual({ ...EMPTY_FILTERS, untagged: true });
  });

  it('ignores a blank name', () => {
    expect(addView([], '   ', coffee)).toEqual([]);
  });

  it('keeps at most the newest views', () => {
    let views: SavedView[] = [];
    for (let index = 0; index <= MAX_SAVED_VIEWS; index++) {
      views = addView(views, `View ${index}`, coffee);
    }
    expect(views).toHaveLength(MAX_SAVED_VIEWS);
    expect(views[0].name).toBe('View 1');
  });

  it('renames, refusing a blank name or one already taken', () => {
    const views = addView(addView([], 'Coffee', coffee), 'Rent', EMPTY_FILTERS);
    const [first, second] = views;
    expect(renameView(views, first.id, 'Cafés')[0].name).toBe('Cafés');
    expect(renameView(views, first.id, ' ')).toBe(views);
    expect(renameView(views, first.id, 'rent')).toBe(views);
    expect(renameView(views, second.id, 'Rent ')[1].name).toBe('Rent');
  });

  it('deletes by id', () => {
    const views = addView(addView([], 'Coffee', coffee), 'Rent', EMPTY_FILTERS);
    expect(removeView(views, views[0].id).map(view => view.name)).toEqual(['Rent']);
  });
});
