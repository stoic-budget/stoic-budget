import { ForbiddenException } from '@nestjs/common';
import { RegistrationOpenGuard } from '@/modules/auth/guards/registration-open.guard';

describe('RegistrationOpenGuard', () => {
  const allows = (body: unknown, open: boolean) =>
    new RegistrationOpenGuard({ isOpen: vi.fn(async () => open) } as never).canActivate({
      switchToHttp: () => ({ getRequest: () => ({ body }) }),
    } as never);

  it('lets anyone through while sign-up is open', async () => {
    await expect(allows({}, true)).resolves.toBe(true);
  });

  it('refuses someone without an invitation when it is closed', async () => {
    await expect(allows({ email: 'member-1@example.com' }, false)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(allows({ invitationToken: '   ' }, false)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('leaves an invitation for the service to check when it is closed', async () => {
    await expect(allows({ invitationToken: 'invite-token' }, false)).resolves.toBe(true);
  });
});
