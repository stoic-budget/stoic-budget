import { describe, expect, it } from 'vitest';
import { healthCheck, healthQueue, systemHealth } from '@/app/test/fixtures/contracts';
import { bannerProblem } from './banner-problem';

describe('bannerProblem', () => {
  it('stays quiet on a healthy server, on warnings and on parts not set up', () => {
    expect(bannerProblem(undefined)).toBeNull();
    expect(bannerProblem(systemHealth())).toBeNull();
    expect(
      bannerProblem(
        systemHealth({
          level: 'warning',
          queues: [healthQueue({ name: 'statement-parsing', level: 'warning', reason: 'latency_high' })],
        }),
      ),
    ).toBeNull();
  });

  it('names Redis first: a stopped worker is its consequence', () => {
    const health = systemHealth({
      level: 'error',
      services: [healthCheck({ key: 'database' }), healthCheck({ key: 'redis', level: 'error', reason: 'unreachable' })],
      queues: [healthQueue({ name: 'statement-parsing', level: 'unknown', reason: 'redis_down' })],
    });
    expect(bannerProblem(health)).toEqual({ kind: 'redis' });
  });

  it('says since when background jobs stopped: the earliest last heartbeat', () => {
    const health = systemHealth({
      level: 'error',
      queues: [
        healthQueue({ name: 'ledger-sync', level: 'error', reason: 'worker_stale', workerSeenAt: '2026-11-10T09:00:00.000Z' }),
        healthQueue({ name: 'statement-parsing', level: 'error', reason: 'worker_stale', workerSeenAt: '2026-11-10T08:30:00.000Z' }),
      ],
    });
    expect(bannerProblem(health)).toEqual({ kind: 'worker', since: '2026-11-10T08:30:00.000Z' });
  });

  it('gives no time when a queue never had a worker', () => {
    const health = systemHealth({
      level: 'error',
      queues: [
        healthQueue({ name: 'ledger-sync', level: 'error', reason: 'worker_stale', workerSeenAt: '2026-11-10T09:00:00.000Z' }),
        healthQueue({ name: 'statement-parsing', level: 'error', reason: 'worker_missing', workerSeenAt: null }),
      ],
    });
    expect(bannerProblem(health)).toEqual({ kind: 'worker', since: null });
  });

  it('says the check itself failed before anything an older answer said', () => {
    expect(bannerProblem(systemHealth(), true)).toEqual({ kind: 'unanswered' });
    expect(bannerProblem(undefined, true)).toEqual({ kind: 'unanswered' });
  });

  it('flags stuck jobs, then a setup error', () => {
    expect(
      bannerProblem(
        systemHealth({ level: 'error', queues: [healthQueue({ name: 'ledger-sync', level: 'error', reason: 'stuck' })] }),
      ),
    ).toEqual({ kind: 'stuck' });
    expect(
      bannerProblem(
        systemHealth({
          level: 'error',
          config: [healthCheck({ key: 'smtp', level: 'error', reason: 'last_send_failed', since: '2026-11-10T09:00:00.000Z' })],
        }),
      ),
    ).toEqual({ kind: 'setup' });
  });
});
