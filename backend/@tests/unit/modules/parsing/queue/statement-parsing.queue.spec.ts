import { StatementParsingQueue } from '@/modules/parsing/queue/statement-parsing.queue';

describe('StatementParsingQueue', () => {
  const build = (state: string) => {
    const queue = {
      getJobState: vi.fn(async () => state),
      remove: vi.fn(async () => 1),
      add: vi.fn(async () => undefined),
    };
    return { queue, parsing: new StatementParsingQueue(queue as never) };
  };

  it('clears a failed job of the statement first, so teaching or a new file parses it again', async () => {
    const { queue, parsing } = build('failed');

    await parsing.enqueue('stmt-1');

    expect(queue.remove).toHaveBeenCalledWith('stmt-1');
    expect(queue.add).toHaveBeenCalledWith('parse', { statementId: 'stmt-1' }, expect.objectContaining({ jobId: 'stmt-1' }));
    expect(queue.remove.mock.invocationCallOrder[0]).toBeLessThan(queue.add.mock.invocationCallOrder[0]);
  });

  it('leaves a waiting or running job alone: the duplicate add is ignored', async () => {
    for (const state of ['waiting', 'active', 'delayed', 'unknown']) {
      const { queue, parsing } = build(state);

      await parsing.enqueue('stmt-1');

      expect(queue.remove).not.toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalled();
    }
  });
});
