import { BadRequestException } from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';
import type { SourceFiltersInput } from '../../../contracts';
import type { SourceAdapter, SourceFilters, SourceRow } from '../sources/source.types';
import { MAX_SOURCE_ROWS } from '../sources/source.utils';
import { type JsonObject } from './row-data';

export async function fetchSourceRows(
  adapter: SourceAdapter,
  workspaceId: string,
  filters: SourceFilters,
): Promise<SourceRow[]> {
  const rows = await adapter.fetchRows(workspaceId, filters);
  if (rows.length > MAX_SOURCE_ROWS) {
    throw new BadRequestException(appError('SOURCE_TOO_MANY_ROWS', { limit: MAX_SOURCE_ROWS }));
  }
  return rows;
}

/** Empty filter values are dropped so the stored binding equals what the preview used. */
export function normalizeSourceFilters(filters: SourceFiltersInput | undefined): JsonObject {
  const normalized: JsonObject = {};
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value) && !value.length) {
      continue;
    }
    normalized[key] = value;
  }
  return normalized;
}
