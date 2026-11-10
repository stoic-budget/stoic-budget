import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_NAME } from '../../../common/brand';
import type { PasskeyCredential, User } from '../../../entities';
import { MailerService } from '../../mailer/mailer.service';
import { PASSKEY_NOTICE_TRANSLATIONS, type PasskeyNoticeText } from './passkey-notice-translations';

export type PasskeyNoticeEvent = 'added' | 'removed';

/**
 * What a notice needs of the account: who to write to, in which language and
 * zone. Not the account name: it can be changed without the password, so a
 * stolen session could use it to write "this was us, nothing to do" into the
 * notice meant to warn the owner.
 */
export type PasskeyNoticeRecipient = Pick<
  User,
  'id' | 'email' | 'workspaceId' | 'locale' | 'timeZone'
>;

/** Only the label and the kind of a passkey reach the mail: never its key, id or counter. */
export type PasskeyNoticeItem = Pick<PasskeyCredential, 'name' | 'deviceType'>;

const fill = (template: string, values: Record<string, string>): string =>
  // A replacer function, so a `$&` in a name or an address stays literal.
  template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? '');

/**
 * A passkey's label as one quoted line. The name is whatever was typed when it
 * was added, so a line break or a control character in it must not let it pose
 * as more lines of the mail ("this was you, nothing to do").
 */
const quotedName = (name: string): string =>
  `“${name.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\s]+/gu, ' ').trim()}”`;

function formatWhen(at: Date, locale: string, timeZone: string | null): string {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timeZone || 'UTC',
  };
  try {
    return `${new Intl.DateTimeFormat(locale, options).format(at)} (${options.timeZone})`;
  } catch {
    // An unknown zone or locale on the profile: the time still goes out, in UTC.
    return `${at.toISOString().slice(0, 16).replace('T', ' ')} (UTC)`;
  }
}

/**
 * Tells the account owner, by e-mail, that a passkey was added or removed. A
 * passkey signs in without the password and outlives "log out everywhere" and
 * a password reset, so one planted during a compromise must not go unnoticed.
 *
 * Never throws: a mail failure must not fail or undo the change it reports.
 */
@Injectable()
export class PasskeyNoticeService {
  private readonly logger = new Logger(PasskeyNoticeService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async send(
    user: PasskeyNoticeRecipient,
    event: PasskeyNoticeEvent,
    passkeys: readonly PasskeyNoticeItem[],
    at: Date = new Date(),
  ): Promise<void> {
    if (passkeys.length === 0) return;
    try {
      if (!(await this.mailerService.isAccountMailConfigured(user))) {
        this.logger.debug(`Passkey ${event} notice skipped for user ${user.id}: no mail server`);
        return;
      }
      const { subject, text } = this.render(user, event, passkeys, at);
      await this.mailerService.send({ to: user.email, subject, text, accountOf: user });
    } catch (error: unknown) {
      // The code only: an SMTP error message can quote the recipient's address.
      const code = (error as { code?: unknown })?.code ?? (error as Error)?.name ?? 'unknown';
      this.logger.warn(`Passkey ${event} notice for user ${user.id} not sent (${String(code)})`);
    }
  }

  render(
    user: PasskeyNoticeRecipient,
    event: PasskeyNoticeEvent,
    passkeys: readonly PasskeyNoticeItem[],
    at: Date,
  ): { subject: string; text: string } {
    const locale = PASSKEY_NOTICE_TRANSLATIONS[user.locale] ? user.locale : 'en';
    const t: PasskeyNoticeText = PASSKEY_NOTICE_TRANSLATIONS[locale];
    const values = {
      app: APP_NAME,
      when: formatWhen(at, locale, user.timeZone),
      url: `${this.frontendBaseUrl()}/settings/profile?tab=security&section=passkeys`,
    };
    const subject = fill(
      event === 'added'
        ? t.addedSubject
        : passkeys.length > 1
          ? t.removedSubjectMany
          : t.removedSubject,
      values,
    );
    const lines = passkeys.map(
      passkey =>
        `• ${quotedName(passkey.name)} (${passkey.deviceType === 'multiDevice' ? t.synced : t.deviceOnly})`,
    );
    const text = [
      t.greeting,
      '',
      subject,
      '',
      ...lines,
      '',
      fill(t.when, values),
      ...(event === 'added' ? [t.addedNote] : []),
      '',
      fill(t.review, values),
      event === 'added' ? t.notYouAdded : t.notYouRemoved,
    ].join('\n');
    return { subject, text };
  }

  private frontendBaseUrl(): string {
    const base =
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL') ||
      'http://localhost:3000';
    return base.replace(/\/+$/, '');
  }
}
