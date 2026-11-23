import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

export const STATEMENT_PARSING_QUEUE = 'statement-parsing';

export interface StatementParsingJob {
  statementId: string;
}

/**
 * Entry point for statement processing.
 *
 * Uploads used to call `processStatement()` fire-and-forget, so a restart mid-parse
 * lost the work with no retry and no record. The queue gives durability and
 * retries; `jobId = statementId` gives cross-instance deduplication, which the
 * previous in-process Map and Semaphore could not do.
 */
@Injectable()
export class StatementParsingQueue {
  private readonly logger = new Logger(StatementParsingQueue.name);

  constructor(
    @InjectQueue(STATEMENT_PARSING_QUEUE)
    private readonly queue: Queue<StatementParsingJob>,
  ) {}

  /**
   * Enqueues a statement for parsing. Safe to call repeatedly: while a job for
   * this statement is waiting or active, BullMQ ignores the duplicate id; a
   * finished one is cleared first so the statement is parsed again.
   */
  async enqueue(statementId: string): Promise<void> {
    try {
      // A failed job stays in Redis under the statement's id (removeOnFail), and
      // BullMQ ignores an add with an id it already holds: a statement taught or
      // given a new file after a failure would never be parsed again.
      const state = await this.queue.getJobState(statementId);
      if (state === 'failed' || state === 'completed') {
        await this.queue.remove(statementId);
      }
      await this.queue.add(
        'parse',
        { statementId },
        {
          jobId: statementId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: true,
          // Kept so a permanently failed statement stays inspectable.
          removeOnFail: 500,
        },
      );
    } catch (error) {
      // Redis being down must not lose the upload: the statement is already
      // persisted as UPLOADED and the reaper below will pick it up.
      this.logger.error(
        `Failed to enqueue statement ${statementId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
