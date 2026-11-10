import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  type VerifiedRegistrationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import * as bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import type { Passkey, PasskeyAttestation, PasskeyCreationOptions } from '../../../contracts';
import { PasskeyCredential, User } from '../../../entities';
import { AuditService } from '../../audit/audit.service';
import { PasskeyChallengeStore } from './passkey-challenge.store';
import {
  deleteOwnPasskeys,
  knownTransports,
  PASSKEY_TIMEOUT_MS,
  type PasskeyCleanup,
  type RemovedPasskey,
  recordPasskeyEvent,
  toPasskey,
} from './passkey-helpers';
import { type PasskeyNoticeRecipient, PasskeyNoticeService } from './passkey-notice.service';
import { relyingParty } from './passkey-relying-party';

/** ES256 and RS256: what platform authenticators and security keys sign with. */
const SUPPORTED_ALGORITHMS = [-7, -257];

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

/** A person's own passkeys: list, add (after a password check), rename and remove. */
@Injectable()
export class PasskeysService {
  private readonly logger = new Logger(PasskeysService.name);

  constructor(
    @InjectRepository(PasskeyCredential)
    private readonly credentials: Repository<PasskeyCredential>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly challenges: PasskeyChallengeStore,
    private readonly auditService: AuditService,
    private readonly notices: PasskeyNoticeService,
  ) {}

  async list(userId: string): Promise<Passkey[]> {
    const rows = await this.credentials.find({ where: { userId }, order: { createdAt: 'ASC' } });
    return rows.map(toPasskey);
  }

  /**
   * Starts adding a passkey. The password is asked again here, so a session left
   * open on someone else's screen cannot quietly plant a key of theirs.
   */
  async registrationOptions(userId: string, password: string): Promise<PasskeyCreationOptions> {
    const user = await this.loadUser(userId);
    await this.assertPassword(user, password);

    const rp = relyingParty();
    const existing = await this.credentials.find({
      where: { userId },
      select: { id: true, credentialId: true, transports: true },
    });
    const options = await generateRegistrationOptions({
      rpName: rp.name,
      rpID: rp.id,
      userID: new Uint8Array(Buffer.from(user.id, 'utf8')),
      userName: user.email,
      userDisplayName: user.name || user.email,
      timeout: PASSKEY_TIMEOUT_MS,
      attestationType: 'none',
      excludeCredentials: existing.map(row => ({
        id: row.credentialId,
        transports: knownTransports(row.transports),
      })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
    });
    await this.challenges.issue('register', user.id, options.challenge);

    return {
      challenge: options.challenge,
      rp: { id: rp.id, name: rp.name },
      user: options.user,
      pubKeyCredParams: options.pubKeyCredParams.map(({ alg }) => ({ alg, type: 'public-key' })),
      timeout: PASSKEY_TIMEOUT_MS,
      excludeCredentials: (options.excludeCredentials ?? []).map(({ id, transports }) => ({
        id,
        type: 'public-key',
        ...(transports ? { transports } : {}),
      })),
      authenticatorSelection: {
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'preferred',
      },
      attestation: 'none',
    };
  }

  /** Finishes adding a passkey: the answer must sign the challenge issued to this user. */
  async register(userId: string, name: string, credential: PasskeyAttestation): Promise<Passkey> {
    const label = this.cleanName(name);
    const user = await this.loadUser(userId);
    // Consumed before anything is checked: whatever the outcome, it cannot be tried twice.
    const challenge = await this.challenges.consume('register', user.id);
    if (!challenge) {
      throw new BadRequestException(appError('AUTH_PASSKEY_REGISTRATION_INVALID'));
    }

    const info = (await this.verifyRegistration(credential, challenge)).registrationInfo;
    if (!info) {
      throw new BadRequestException(appError('AUTH_PASSKEY_REGISTRATION_INVALID'));
    }

    const saved = await this.credentials
      .save(
        this.credentials.create({
          userId: user.id,
          credentialId: info.credential.id,
          publicKey: Buffer.from(info.credential.publicKey),
          signCount: info.credential.counter,
          transports: knownTransports(credential.response.transports),
          backedUp: info.credentialBackedUp,
          deviceType: info.credentialDeviceType,
          name: label,
          lastUsedAt: null,
        }),
      )
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ConflictException(appError('AUTH_PASSKEY_ALREADY_REGISTERED'));
        }
        throw error;
      });
    await recordPasskeyEvent(
      this.auditService,
      this.logger,
      this.users.manager,
      user,
      'added',
      saved.id,
    );
    await this.notices.send(user, 'added', [saved]);

    return toPasskey(saved);
  }

  async rename(userId: string, passkeyId: string, name: string): Promise<Passkey> {
    const label = this.cleanName(name);
    const row = await this.credentials.findOne({ where: { id: passkeyId, userId } });
    if (!row) {
      throw new NotFoundException(appError('AUTH_PASSKEY_NOT_FOUND'));
    }
    await this.credentials.update({ id: row.id, userId }, { name: label });
    return toPasskey({ ...row, name: label });
  }

  /**
   * Removes a passkey after a password check. Every account keeps its password
   * (it cannot be removed), so a passkey is never the last way in.
   */
  async remove(userId: string, passkeyId: string, password: string): Promise<void> {
    const user = await this.loadUser(userId);
    await this.assertPassword(user, password);

    const removed = await deleteOwnPasskeys(this.users.manager, user.id, [passkeyId]);
    if (removed.length === 0) {
      throw new NotFoundException(appError('AUTH_PASSKEY_NOT_FOUND'));
    }
    await this.reportRemoved(user, removed);
  }

  /**
   * Removes several of the person's own passkeys after a password check, as
   * a cleanup ("log out everywhere"). Ids that are not theirs match nothing.
   */
  async removeMany(
    userId: string,
    passkeyIds: readonly string[],
    password: string,
    via: PasskeyCleanup,
  ): Promise<void> {
    const user = await this.loadUser(userId);
    await this.assertPassword(user, password);
    await this.reportRemoved(
      user,
      await deleteOwnPasskeys(this.users.manager, user.id, passkeyIds),
      via,
    );
  }

  /** Audits each removed passkey and sends the owner one mail about all of them. */
  async reportRemoved(
    user: PasskeyNoticeRecipient,
    removed: readonly RemovedPasskey[],
    via?: PasskeyCleanup,
  ): Promise<void> {
    for (const passkey of removed) {
      await recordPasskeyEvent(
        this.auditService,
        this.logger,
        this.users.manager,
        user,
        'removed',
        passkey.id,
        via,
      );
    }
    await this.notices.send(user, 'removed', removed);
  }

  private async verifyRegistration(
    credential: PasskeyAttestation,
    expectedChallenge: string,
  ): Promise<VerifiedRegistrationResponse> {
    const rp = relyingParty();
    const verification = await verifyRegistrationResponse({
      response: credential as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: rp.origins,
      expectedRPID: rp.id,
      requireUserVerification: false,
      supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
    }).catch((error: unknown) => {
      this.logger.debug(`Passkey registration refused: ${(error as Error)?.message}`);
      return null;
    });
    if (!verification?.verified) {
      throw new BadRequestException(appError('AUTH_PASSKEY_REGISTRATION_INVALID'));
    }
    return verification;
  }

  private cleanName(name: string): string {
    const label = name.trim();
    if (!label) {
      throw new BadRequestException(appError('AUTH_PASSKEY_NAME_REQUIRED'));
    }
    return label;
  }

  private async loadUser(userId: string): Promise<User> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        workspaceId: true,
        passwordHash: true,
        locale: true,
        timeZone: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException(appError('USER_NOT_FOUND'));
    }
    return user;
  }

  private async assertPassword(user: User, password: string): Promise<void> {
    const isValid = user.passwordHash
      ? await bcrypt.compare(password || '', user.passwordHash)
      : false;
    if (!isValid) {
      throw new ForbiddenException(appError('AUTH_CURRENT_PASSWORD_INCORRECT'));
    }
  }
}
