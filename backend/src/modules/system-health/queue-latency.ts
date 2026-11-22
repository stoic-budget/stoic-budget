import type { Job, Queue } from 'bullmq';
import type { HealthRedisService } from './health-redis.service';

/** The events stream is read this many entries at a time, newest first. */
const EVENTS_PAGE = 500;
/** BullMQ trims its events stream to about 10 000 entries by default; read no further. */
const EVENTS_MAX = 10_000;

/** A stream entry's fields come as [name, value, name, value, …]. */
const field = (fields: string[], name: string): string | undefined => {
  for (let at = 0; at < fields.length - 1; at += 2) {
    if (fields[at] === name) return fields[at + 1];
  }
  return undefined;
};

/**
 * When a waiting job joined the line. The job itself keeps only when it was
 * created: BullMQ sets `delay` back to 0 when it promotes a delayed job, and a
 * retried job keeps its first timestamp. Every move into "waiting" (added,
 * promoted, retried, back from a stalled worker) writes a "waiting" entry to
 * the queue's events stream, and the entry id is the time it happened, so the
 * newest such entry for the job is when it last became due.
 */
export async function becameDueAt(
  redis: Pick<HealthRedisService, 'streamPage'>,
  queue: Pick<Queue, 'keys'>,
  job: Job,
): Promise<Date> {
  let end = '+';
  let previous: string | null = null;
  for (let read = 0; read < EVENTS_MAX; read += EVENTS_PAGE) {
    const entries = await redis.streamPage(queue.keys.events, end, EVENTS_PAGE);
    for (const [id, fields] of entries) {
      if (id === previous) continue;
      if (field(fields, 'event') === 'waiting' && field(fields, 'jobId') === job.id) {
        return new Date(Number(id.split('-')[0]));
      }
    }
    if (entries.length < EVENTS_PAGE) break;
    // Inclusive range (works on Redis before 6.2): the boundary entry comes again and is skipped.
    const last = entries[entries.length - 1][0];
    previous = last;
    end = last;
  }
  return knownDueAt(job);
}

/**
 * The entry was trimmed away (thousands of events since): the latest moment the
 * job is known to have been due, from its own fields. Its last attempt started
 * at `processedOn`; it became due again some time after that.
 */
export function knownDueAt(job: Pick<Job, 'timestamp' | 'opts' | 'processedOn'>): Date {
  return new Date(Math.max(job.timestamp + (job.opts.delay ?? 0), job.processedOn ?? 0));
}
