/** Every page of a list, `load` fetching one by its number and offset. */
export async function fetchAllPages<T>(
  pageSize: number,
  load: (page: number, offset: number) => Promise<{ items: readonly T[]; total: number }>,
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (results.length < total) {
    const batch = await load(page, offset);
    results.push(...batch.items);
    total = batch.total;
    if (batch.items.length < pageSize) {
      break;
    }
    page += 1;
    offset += pageSize;
  }

  return results;
}
