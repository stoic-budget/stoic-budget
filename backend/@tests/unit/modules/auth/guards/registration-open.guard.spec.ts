import { ForbiddenException } from '@nestjs/common';
import { RegistrationOpenGuard } from '@/modules/auth/guards/registration-open.guard';

describe('RegistrationOpenGuard', () => {
  const before = process.env.REGISTRATION_ENABLED;
  afterEach(() => {
    if (before === undefined) delete process.env.REGISTRATION_ENABLED;
    else process.env.REGISTRATION_ENABLED = before;
  });

  const allows = (body: unknown, users = 1) =>
    new RegistrationOpenGuard({ count: vi.fn(async () => users) } as never).canActivate({
      switchToHttp: () => ({ getRequest: () => ({ body }) }),
    } as never);

  it('lets anyone register by default', async () => {
    delete process.env.REGISTRATION_ENABLED;
    await expect(allows({})).resolves.toBe(true);
  });

  describe('when closed', () => {
    beforeEach(() => {
      process.env.REGISTRATION_ENABLED = 'false';
    });

    it('refuses someone without an invitation', async () => {
      await expect(allows({ email: 'member-1@example.com' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(allows({ invitationToken: '   ' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('leaves an invitation for the service to check', async () => {
      await expect(allows({ invitationToken: 'invite-token' })).resolves.toBe(true);
    });

    it('still lets the first account in, or the server would never get an owner', async () => {
      await expect(allows({}, 0)).resolves.toBe(true);
    });
  });
});
