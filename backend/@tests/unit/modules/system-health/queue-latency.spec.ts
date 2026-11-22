import { knownDueAt } from '@/modules/system-health/queue-latency';

describe('knownDueAt (the job fields, when the events stream no longer has it)', () => {
  const created = Date.parse('2026-11-10T08:00:00.000Z');

  it('is when the job was added, for a job that never ran and had no delay', () => {
    expect(knownDueAt({ timestamp: created, opts: {}, processedOn: undefined }).getTime()).toBe(created);
  });

  it('is when the requested delay ran out, for a delayed job', () => {
    expect(knownDueAt({ timestamp: created, opts: { delay: 60_000 }, processedOn: undefined }).getTime()).toBe(
      created + 60_000,
    );
  });

  it('is no earlier than its last attempt started, for a retried job', () => {
    const lastAttempt = created + 20 * 60_000;
    expect(knownDueAt({ timestamp: created, opts: {}, processedOn: lastAttempt }).getTime()).toBe(lastAttempt);
  });
});
