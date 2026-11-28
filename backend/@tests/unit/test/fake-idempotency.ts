/**
 * `IdempotencyService.once` for controller tests: runs the work once per key
 * and answers a repeat with the first answer, as the table does.
 */
export function fakeIdempotency() {
  const answers = new Map<string, unknown>();
  return {
    once: vi.fn(
      async (
        key: string | null | undefined,
        _userId: string,
        _workspaceId: string,
        work: () => Promise<unknown>,
      ) => {
        if (key && answers.has(key)) return { data: answers.get(key), cached: true };
        const data = await work();
        if (key) answers.set(key, data);
        return { data, cached: false };
      },
    ),
  };
}
