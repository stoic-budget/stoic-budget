import { filtersFromParams, filtersKey, type TransactionFilters } from './transaction-filters';

/** A named filter set; `filters` is the URL query those filters make. */
export interface SavedView {
  id: string;
  name: string;
  filters: string;
}

/**
 * What the `transactions` view preference holds. Keys other than `savedViews`
 * are kept as they were saved, so a save here never drops them.
 */
export type TransactionsPreference = { savedViews: SavedView[] } & Record<string, unknown>;

export const MAX_SAVED_VIEWS = 30;
export const MAX_VIEW_NAME = 60;

function isSavedView(value: unknown): value is SavedView {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const view = value as Record<string, unknown>;
  return (
    typeof view.id === 'string' &&
    typeof view.name === 'string' &&
    view.name.trim() !== '' &&
    typeof view.filters === 'string'
  );
}

/** The stored preference, its saved views narrowed key by key. */
export function readTransactionsPreference(
  saved: Readonly<Record<string, unknown>>,
): TransactionsPreference {
  const views = Array.isArray(saved.savedViews) ? saved.savedViews.filter(isSavedView) : [];
  return { ...saved, savedViews: views };
}

export function viewFilters(view: SavedView): TransactionFilters {
  return filtersFromParams(new URLSearchParams(view.filters));
}

function newId(): string {
  // Not crypto.randomUUID: it is missing on plain-http self-hosted instances.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Saves `filters` under `name`; a view of that name already there takes the new filters. */
export function addView(
  views: SavedView[],
  name: string,
  filters: TransactionFilters,
): SavedView[] {
  const trimmed = name.trim().slice(0, MAX_VIEW_NAME);
  if (!trimmed) {
    return views;
  }
  const query = filtersKey(filters);
  if (views.some(view => sameName(view.name, trimmed))) {
    return views.map(view => (sameName(view.name, trimmed) ? { ...view, filters: query } : view));
  }
  return [...views, { id: newId(), name: trimmed, filters: query }].slice(-MAX_SAVED_VIEWS);
}

/** A blank name, or one another view already has, leaves the list as it was. */
export function renameView(views: SavedView[], id: string, name: string): SavedView[] {
  const trimmed = name.trim().slice(0, MAX_VIEW_NAME);
  if (!trimmed || views.some(view => view.id !== id && sameName(view.name, trimmed))) {
    return views;
  }
  return views.map(view => (view.id === id ? { ...view, name: trimmed } : view));
}

export function removeView(views: SavedView[], id: string): SavedView[] {
  return views.filter(view => view.id !== id);
}
