import { createHash } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import type { PasskeyAssertion, PasskeyRequestOptions } from '../../../contracts';
import { PasskeyCredential, User } from '../../../entities';
import { AuditService } from '../../audit/audit.service';
import { PasskeyChallengeStore, type PasskeyFlow } from './passkey-challenge.store';
import {
  knownTransports,
  PASSKEY_TIMEOUT_MS,
  recordPasskeyEvent,
  userHandleOf,
} from './passkey-helpers';
import { relyingParty } from './passkey-relying-party';

type UserVerification = PasskeyRequestOptions['userVerification'];

const invalid = () => new UnauthorizedException(appError('AUTH_PASSKEY_INVALID'));

/** The sign-in flow cookie is a bearer secret: only its hash names the challenge. */
const flowSubject = (flowSecret: string): string =>
  createHash('sha256').update(flowSecret).digest('hex');

/**
 * The second factor's challenge belongs to one login attempt: the user and the
 * browser that typed the password (its `passkey_2fa` cookie). Another login of
 * the same account, from another device or by someone holding the password,
 * gets its own challenge and leaves this one standing.
 */
const secondFactorSubject = (userId: string, flowSecret: string): string =>
  `${userId}:${flowSubject(flowSecret)}`;

/** The flow cookie a second-factor answer came with, and the fresh secret a new challenge is bound to. */
export interface SecondFactorFlow {
  presented?: string;
  issued: string;
}

/**
 * Signing in with a passkey: on its own (no e-mail, user verification required)
 * or as the second factor after the password (user verification preferred).
 *
 * A passkey sign-in with user verification counts as two factors (the device,
 * plus the PIN or biometric that unlocked it), so it does not ask for the TOTP
 * code even when the account has 2FA on.
 */
@Injectable()
export class PasskeyAuthService {
  private readonly logger = new Logger(PasskeyAuthService.name);

  constructor(
    @InjectRepository(PasskeyCredential)
    private readonly credentials: Repository<PasskeyCredential>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly challenges: PasskeyChallengeStore,
    private readonly auditService: AuditService,
  ) {}

  /** The challenge for the second factor, or undefined when the user has no passkey. */
  async secondFactorOptions(
    userId: string,
    flowSecret: string,
  ): Promise<PasskeyRequestOptions | undefined> {
    const rows = await this.credentials.find({
      where: { userId },
      select: { id: true, credentialId: true, transports: true },
    });
    if (rows.length === 0) {
      return undefined;
    }
    return this.requestOptions(
      'second-factor',
      secondFactorSubject(userId, flowSecret),
      rows,
      'preferred',
    );
  }

  /** Must answer the challenge `secondFactorOptions` issued to this same user and browser. */
  async assertSecondFactor(
    userId: string,
    flowSecret: string | undefined,
    assertion: PasskeyAssertion,
  ): Promise<void> {
    const challenge = flowSecret
      ? await this.challenges.consume('second-factor', secondFactorSubject(userId, flowSecret))
      : null;
    const credential = await this.findCredential(assertion.id);
    if (!challenge || !credential || credential.userId !== userId) {
      throw invalid();
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw invalid();
    }
    await this.verify(credential, user, assertion, challenge, false);
  }

  /** A challenge for a sign-in without an e-mail, bound to the browser's flow cookie. */
  async signInOptions(flowSecret: string): Promise<PasskeyRequestOptions> {
    return this.requestOptions('sign-in', flowSubject(flowSecret), [], 'required');
  }

  /**
   * The user a passkey signed in. Every failure before the signature is checked
   * gives the same answer, so it tells nothing about which accounts exist.
   */
  async signIn(flowSecret: string | undefined, assertion: PasskeyAssertion): Promise<User> {
    // Consumed first: a failed attempt spends the challenge as well.
    const challenge = flowSecret
      ? await this.challenges.consume('sign-in', flowSubject(flowSecret))
      : null;
    const credential = await this.findCredential(assertion.id);
    if (!challenge || !credential) {
      throw invalid();
    }
    // Soft-deleted accounts are not found here: their passkeys stop working with them.
    const user = await this.users.findOne({ where: { id: credential.userId } });
    const userHandle = assertion.response.userHandle;
    if (!user || (userHandle && userHandle !== userHandleOf(user.id))) {
      throw invalid();
    }
    await this.verify(credential, user, assertion, challenge, true);
    if (!user.isActive) {
      throw new UnauthorizedException(appError('AUTH_ACCOUNT_INACTIVE'));
    }
    await this.users.update(user.id, { lastLogin: new Date() });
    return user;
  }

  private async requestOptions(
    flow: PasskeyFlow,
    subject: string,
    rows: PasskeyCredential[],
    userVerification: UserVerification,
  ): Promise<PasskeyRequestOptions> {
    const rp = relyingParty();
    const options = await generateAuthenticationOptions({
      rpID: rp.id,
      allowCredentials: rows.map(row => ({
        id: row.credentialId,
        transports: knownTransports(row.transports),
      })),
      userVerification,
      timeout: PASSKEY_TIMEOUT_MS,
    });
    await this.challenges.issue(flow, subject, options.challenge);
    return {
      challenge: options.challenge,
      rpId: rp.id,
      timeout: PASSKEY_TIMEOUT_MS,
      userVerification,
      allowCredentials: (options.allowCredentials ?? []).map(({ id, transports }) => ({
        id,
        type: 'public-key',
        ...(transports ? { transports } : {}),
      })),
    };
  }

  /**
   * Checks the answer against the configured origin and RP ID, the challenge and
   * the stored public key, then moves the sign counter forward. The library's
   * own counter check runs before the signature, so it gets 0 here and the
   * counter is checked afterwards: only a correctly signed answer can raise the
   * cloned-key alarm.
   */
  private async verify(
    credential: PasskeyCredential,
    user: User,
    assertion: PasskeyAssertion,
    expectedChallenge: string,
    requireUserVerification: boolean,
  ): Promise<void> {
    const rp = relyingParty();
    const result = await verifyAuthenticationResponse({
      response: assertion as AuthenticationResponseJSON,
      expectedChallenge,
      expectedOrigin: rp.origins,
      expectedRPID: rp.id,
      requireUserVerification,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(credential.publicKey),
        counter: 0,
        transports: knownTransports(credential.transports),
      },
    }).catch((error: unknown) => {
      this.logger.debug(`Passkey assertion refused: ${(error as Error)?.message}`);
      return null;
    });
    if (!result?.verified) {
      throw invalid();
    }

    if (!(await this.advanceCounter(credential.id, result.authenticationInfo.newCounter))) {
      await recordPasskeyEvent(
        this.auditService,
        this.logger,
        this.users.manager,
        user,
        'counter_regression',
        credential.id,
      );
      throw new UnauthorizedException(appError('AUTH_PASSKEY_COUNTER_REGRESSION'));
    }
  }

  /**
   * Stores the new counter and the time of use, only when the counter moved
   * forward (or the authenticator keeps none: 0 then 0). One conditional update,
   * so of two answers racing with one counter value only one is accepted.
   */
  private async advanceCounter(credentialId: string, next: number): Promise<boolean> {
    const result = await this.credentials
      .createQueryBuilder()
      .update(PasskeyCredential)
      .set({ signCount: next, lastUsedAt: () => 'now()' })
      .where('id = :credentialId', { credentialId })
      .andWhere(next === 0 ? 'sign_count = 0' : 'sign_count < :next', { next })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  private findCredential(credentialId: string): Promise<PasskeyCredential | null> {
    return this.credentials.findOne({
      where: { credentialId },
      select: {
        id: true,
        userId: true,
        credentialId: true,
        publicKey: true,
        signCount: true,
        transports: true,
      },
    });
  }
}
