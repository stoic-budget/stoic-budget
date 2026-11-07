import { RegistrationSettingsService } from '@/modules/auth/registration-settings.service';

describe('RegistrationSettingsService', () => {
  const before = process.env.REGISTRATION_ENABLED;
  afterEach(() => {
    if (before === undefined) delete process.env.REGISTRATION_ENABLED;
    else process.env.REGISTRATION_ENABLED = before;
  });

  function build(options: { saved?: unknown; users?: number } = {}) {
    let saved = options.saved ?? null;
    const repository = {
      findOne: vi.fn(async () => saved),
      create: vi.fn((row: unknown) => row),
      save: vi.fn(async (row: unknown) => {
        saved = row;
        return row;
      }),
    };
    const audit = { createEvent: vi.fn(async () => ({})) };
    const service = new RegistrationSettingsService(
      repository as never,
      { count: vi.fn(async () => options.users ?? 1) } as never,
      audit as never,
    );
    return { service, repository, audit };
  }
  const admin = { id: 'admin-1', workspaceId: 'ws-1' } as never;

  it('is open by default, so an existing server stays open', async () => {
    delete process.env.REGISTRATION_ENABLED;
    await expect(build().service.isOpen()).resolves.toBe(true);
  });

  it('follows the environment until an administrator chooses', async () => {
    process.env.REGISTRATION_ENABLED = 'false';
    await expect(build().service.isOpen()).resolves.toBe(false);
  });

  it('lets what the administrator chose win over the environment', async () => {
    process.env.REGISTRATION_ENABLED = 'false';
    await expect(build({ saved: { value: { open: true } } }).service.isOpen()).resolves.toBe(true);

    process.env.REGISTRATION_ENABLED = 'true';
    await expect(build({ saved: { value: { open: false } } }).service.isOpen()).resolves.toBe(false);
  });

  it('stays open for the first account, or the server would never get an owner', async () => {
    process.env.REGISTRATION_ENABLED = 'false';
    await expect(build({ users: 0 }).service.isOpen()).resolves.toBe(true);
    await expect(
      build({ users: 0, saved: { value: { open: false } } }).service.isOpen(),
    ).resolves.toBe(true);
  });

  it('saves the choice and records who made it', async () => {
    delete process.env.REGISTRATION_ENABLED;
    const { service, audit } = build();

    await service.setOpen(admin, false);

    await expect(service.isOpen()).resolves.toBe(false);
    expect(audit.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        diff: { before: { registrationOpen: true }, after: { registrationOpen: false } },
      }),
    );
  });
});
