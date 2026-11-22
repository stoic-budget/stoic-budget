import type { Mock } from 'vitest';
import { Logger } from '@nestjs/common';
import { APP_NAME } from '@/common/brand';
import { PasskeyNoticeService } from '@/modules/auth/passkeys/passkey-notice.service';
import { PASSKEY_NOTICE_TRANSLATIONS } from '@/modules/auth/passkeys/passkey-notice-translations';

const EMAIL = 'member-1@example.com';
const owner = {
  id: 'user-1',
  email: EMAIL,
  name: 'Member One',
  workspaceId: 'ws-1',
  locale: 'en',
  timeZone: 'Europe/Kyiv',
};
const AT = new Date('2026-11-10T12:30:00Z');
const laptop = { name: 'Work laptop', deviceType: 'multiDevice' as const };
const key = { name: 'Desk key', deviceType: 'singleDevice' as const };

describe('PasskeyNoticeService', () => {
  let mailer: { send: Mock; isAccountMailConfigured: Mock };
  let service: PasskeyNoticeService;

  beforeEach(() => {
    mailer = {
      send: vi.fn().mockResolvedValue(true),
      isAccountMailConfigured: vi.fn().mockResolvedValue(true),
    };
    service = new PasskeyNoticeService(
      mailer as never,
      { get: (name: string) => (name === 'APP_URL' ? 'https://budget.example.co.il/' : undefined) } as never,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('tells the owner what was added, how it is kept, when, and where to review it', async () => {
    await service.send(owner, 'added', [laptop], AT);

    expect(mailer.send).toHaveBeenCalledTimes(1);
    const mail = mailer.send.mock.calls[0][0];
    expect(mail.to).toBe(EMAIL);
    // Account mail: sent the way the password-reset mail is.
    expect(mail.accountOf).toBe(owner);
    expect(mail.subject).toBe(`A passkey was added to your ${APP_NAME} account`);
    expect(mail.text.startsWith('Hello,\n')).toBe(true);
    expect(mail.text).toContain('• “Work laptop” (synced across devices)');
    // 12:30 UTC is 14:30 in Kyiv, in the owner's own zone.
    expect(mail.text).toMatch(/When: .*2:30.PM \(Europe\/Kyiv\)/);
    expect(mail.text).toContain(
      'https://budget.example.co.il/settings/profile?tab=security&section=passkeys',
    );
    expect(mail.text).toContain('Not you? Remove it there and reset your password.');
  });

  it('writes one mail for several removed passkeys, in the owner language', async () => {
    await service.send({ ...owner, locale: 'ru' }, 'removed', [laptop, key], AT);

    expect(mailer.send).toHaveBeenCalledTimes(1);
    const { subject, text } = mailer.send.mock.calls[0][0];
    expect(subject).toBe(PASSKEY_NOTICE_TRANSLATIONS.ru.removedSubjectMany.replace('{{app}}', APP_NAME));
    expect(text).toContain('“Work laptop” (синхронизируется между устройствами)');
    expect(text).toContain('“Desk key” (хранится только на одном устройстве)');
    expect(text).toContain(PASSKEY_NOTICE_TRANSLATIONS.ru.notYouRemoved);
  });

  it('falls back to English and UTC for a language or zone it does not know', () => {
    const { subject, text } = service.render(
      { ...owner, locale: 'xx', timeZone: 'Mars/Olympus' },
      'removed',
      [key],
      AT,
    );
    expect(subject).toBe(`A passkey was removed from your ${APP_NAME} account`);
    expect(text.startsWith('Hello,\n')).toBe(true);
    expect(text).toContain('When: 2026-11-10 12:30 (UTC)');
  });

  it('leaves the account name out, so a stolen session cannot write the opening lines', async () => {
    // The name changes without the password: whoever planted the passkey can set it.
    const planted = 'This passkey was set up by our support team. No action is needed.';
    const renamed = { ...owner, name: `Member One\n\n${planted}\n\nThanks` };

    for (const locale of Object.keys(PASSKEY_NOTICE_TRANSLATIONS)) {
      for (const event of ['added', 'removed'] as const) {
        const { subject, text } = service.render({ ...renamed, locale }, event, [laptop], AT);
        expect({ locale, event, leaked: `${subject}\n${text}`.includes('support team') }).toEqual({
          locale,
          event,
          leaked: false,
        });
        expect(text).not.toContain('Member One');
      }
    }
  });

  it('keeps a crafted name on its own quoted line', () => {
    const { text } = service.render(
      owner,
      'added',
      [{ name: 'Phone\n\nThis was you, nothing to do.‮ $& ', deviceType: 'singleDevice' }],
      AT,
    );
    expect(text).toContain('• “Phone This was you, nothing to do. $&” (kept on one device only)');
    expect(text.split('\n').filter(line => line.includes('nothing to do'))).toHaveLength(1);
  });

  it('carries no key material, credential id or counter', async () => {
    const row = {
      ...laptop,
      id: 'passkey-row-id',
      credentialId: 'Y3JlZGVudGlhbC1pZA',
      publicKey: Buffer.from('public-key-bytes'),
      signCount: 4242,
    };
    await service.send(owner, 'added', [row], AT);

    const text = JSON.stringify(mailer.send.mock.calls[0][0]);
    for (const secret of ['passkey-row-id', 'Y3JlZGVudGlhbC1pZA', 'public-key-bytes', '4242']) {
      expect(text).not.toContain(secret);
    }
  });

  it('skips quietly when no mail server is set up', async () => {
    mailer.isAccountMailConfigured.mockResolvedValue(false);
    const warn = vi.spyOn(Logger.prototype, 'warn');

    await expect(service.send(owner, 'added', [laptop], AT)).resolves.toBeUndefined();
    expect(mailer.send).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('swallows a mail failure and logs it without the address', async () => {
    mailer.send.mockRejectedValue(
      Object.assign(new Error(`550 Recipient <${EMAIL}> rejected`), { code: 'EENVELOPE' }),
    );
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(service.send(owner, 'removed', [laptop], AT)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('EENVELOPE');
    expect(JSON.stringify(warn.mock.calls)).not.toContain(EMAIL);
  });

  it('sends nothing for an empty list', async () => {
    await service.send(owner, 'removed', [], AT);
    expect(mailer.isAccountMailConfigured).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('has every text in every language', () => {
    const keys = Object.keys(PASSKEY_NOTICE_TRANSLATIONS.en).sort();
    expect(Object.keys(PASSKEY_NOTICE_TRANSLATIONS)).toHaveLength(35);
    for (const [locale, text] of Object.entries(PASSKEY_NOTICE_TRANSLATIONS)) {
      expect({ locale, keys: Object.keys(text).sort() }).toEqual({ locale, keys });
      for (const value of Object.values(text)) expect(value.trim()).not.toBe('');
      expect(text.review).toContain('{{url}}');
      expect(text.addedSubject).toContain('{{app}}');
    }
  });
});
