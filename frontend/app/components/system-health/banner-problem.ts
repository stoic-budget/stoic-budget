import type { AdminSystemHealth } from '@/app/lib/contracts';

export type BannerProblem =
  | { kind: 'unanswered' }
  | { kind: 'redis' }
  | { kind: 'database' }
  | { kind: 'worker'; since: string | null }
  | { kind: 'stuck' }
  | { kind: 'setup' };

/**
 * The one fault the banner names, most basic first: a service down explains a
 * stopped worker, and a stopped worker explains waiting jobs. Warnings and
 * parts that are simply not set up stay on the health page. When the last
 * check itself failed on the server (`unanswered`), an older answer no longer
 * says anything.
 */
export function bannerProblem(
  health: AdminSystemHealth | undefined,
  unanswered = false,
): BannerProblem | null {
  if (unanswered) return { kind: 'unanswered' };
  if (health?.level !== 'error') {
    return null;
  }
  const down = (key: 'redis' | 'database') =>
    health.services.some(check => check.key === key && check.level === 'error');
  if (down('redis')) return { kind: 'redis' };
  if (down('database')) return { kind: 'database' };
  const stopped = health.queues.filter(
    queue => queue.reason === 'worker_stale' || queue.reason === 'worker_missing',
  );
  if (stopped.length > 0) {
    // The earliest last heartbeat: since then at least one queue has had no worker.
    const seen = stopped.flatMap(queue => (queue.workerSeenAt ? [queue.workerSeenAt] : []));
    const since = seen.length === stopped.length ? [...seen].sort()[0] : null;
    return { kind: 'worker', since };
  }
  if (health.queues.some(queue => queue.reason === 'stuck')) return { kind: 'stuck' };
  if (health.config.some(check => check.level === 'error')) return { kind: 'setup' };
  return null;
}
