import { Reflector } from '@nestjs/core';
import type { User } from '@/entities/user.entity';
import { IS_PUBLIC_KEY } from '@/modules/auth/decorators/public.decorator';
import { ChangelogSeenController } from '@/modules/users/changelog-seen.controller';

describe('ChangelogSeenController', () => {
  const entry = { id: 'changelog-2026-11-01-abc1234', date: '2026-11-01T10:00:00.000Z' };

  it('marks the entry for the caller and answers only the marker', async () => {
    const answer = { changelogSeenId: entry.id, changelogSeenAt: entry.date };
    const service = { markSeen: vi.fn(async () => answer) };

    const result = await new ChangelogSeenController(service as any).markSeen(
      { id: 'user-1' } as User,
      entry,
    );

    expect(service.markSeen).toHaveBeenCalledWith('user-1', entry.id, entry.date);
    expect(result).toEqual(answer);
  });

  it('is not public', () => {
    const isPublic = new Reflector().get<boolean>(
      IS_PUBLIC_KEY,
      ChangelogSeenController.prototype.markSeen,
    );
    expect(isPublic).not.toBe(true);
  });
});
