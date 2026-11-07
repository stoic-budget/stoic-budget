import { SubscriptionDetectionScheduler } from '@/modules/subscriptions/subscription-detection.scheduler';

describe('SubscriptionDetectionScheduler', () => {
  function createScheduler(runDetection: (id: string) => Promise<unknown>) {
    const find = vi.fn(async () => [{ id: 'ws-1' }, { id: 'ws-2' }]);
    const scheduler = new SubscriptionDetectionScheduler(
      { find } as never,
      { runDetection } as never,
    );
    vi.spyOn((scheduler as never as { logger: { error: () => void } }).logger, 'error').mockImplementation(
      () => undefined,
    );
    return { scheduler, find };
  }

  it('runs detection in every workspace, leaving out past versions', async () => {
    const runDetection = vi.fn(async () => []);
    const { scheduler, find } = createScheduler(runDetection);

    await scheduler.detectEverywhere();

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kind: 'standard' } }),
    );
    expect(runDetection.mock.calls.map(call => call[0])).toEqual(['ws-1', 'ws-2']);
  });

  it('keeps going when one workspace fails', async () => {
    const runDetection = vi.fn().mockRejectedValueOnce(new Error('broken')).mockResolvedValue([]);
    const { scheduler } = createScheduler(runDetection);

    await scheduler.detectEverywhere();

    expect(runDetection).toHaveBeenCalledTimes(2);
  });
});
