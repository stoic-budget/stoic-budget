import {
  reviewDuplicatesQuery,
  unconfirmedRowsQuery,
} from '../../../../src/modules/review-inbox/review-queue.queries';

/** A query builder that only remembers its conditions. */
function recordingRepository() {
  const conditions: string[] = [];
  const query: Record<string, unknown> = {};
  for (const method of ['leftJoin', 'where', 'andWhere']) {
    query[method] = (sql: string) => {
      if (method !== 'leftJoin') conditions.push(sql);
      return query;
    };
  }
  return { conditions, repository: { createQueryBuilder: () => query } as never };
}

describe('Review queue queries', () => {
  it('never lists a pending row as waiting for confirmation: it waits for the bank', () => {
    const { conditions, repository } = recordingRepository();

    unconfirmedRowsQuery(repository, 'ws-1');

    expect(conditions).toContain('t.isPending = false');
  });

  it('never asks about a pending row as a possible duplicate', () => {
    const { conditions, repository } = recordingRepository();

    reviewDuplicatesQuery(repository, 'ws-1');

    expect(conditions).toContain('t.isPending = false');
  });
});
