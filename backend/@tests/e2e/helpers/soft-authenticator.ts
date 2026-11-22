import { createHash, generateKeyPairSync, type KeyObject, randomBytes, sign } from 'node:crypto';

/**
 * A WebAuthn authenticator in software, for e2e tests: a P-256 key from
 * node:crypto, with clientDataJSON, authenticatorData and the attestation
 * object built by hand, so every field the server checks can be bent.
 */

type Cbor = number | string | Uint8Array | Cbor[] | Map<Cbor, Cbor>;

const head = (major: number, length: number): Buffer => {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 0x100) return Buffer.from([(major << 5) | 24, length]);
  if (length < 0x10000) return Buffer.from([(major << 5) | 25, length >> 8, length & 0xff]);
  const out = Buffer.alloc(5);
  out[0] = (major << 5) | 26;
  out.writeUInt32BE(length, 1);
  return out;
};

/** The bits of CBOR an attestation object needs: ints, byte and text strings, arrays, maps. */
export function encodeCbor(value: Cbor): Buffer {
  if (typeof value === 'number') {
    return value >= 0 ? head(0, value) : head(1, -1 - value);
  }
  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([head(3, bytes.length), bytes]);
  }
  if (value instanceof Uint8Array) {
    return Buffer.concat([head(2, value.length), Buffer.from(value)]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([head(4, value.length), ...value.map(encodeCbor)]);
  }
  const entries = [...value.entries()];
  return Buffer.concat([
    head(5, entries.length),
    ...entries.flatMap(([key, item]) => [encodeCbor(key), encodeCbor(item)]),
  ]);
}

const b64url = (bytes: Buffer | Uint8Array): string => Buffer.from(bytes).toString('base64url');
const sha256 = (data: Buffer | string): Buffer => createHash('sha256').update(data).digest();

export const FLAG_UP = 0x01;
export const FLAG_UV = 0x04;
const FLAG_AT = 0x40;

export interface CeremonyOverrides {
  origin?: string;
  rpId?: string;
  challenge?: string;
  /** Authenticator flags; user presence and verification by default. */
  flags?: number;
  counter?: number;
  type?: string;
}

export class SoftAuthenticator {
  readonly credentialId: string;
  private readonly privateKey: KeyObject;
  private readonly publicJwk: { x: string; y: string };
  /** The next counter this authenticator reports; 0 keeps it at 0 (no counter). */
  counter: number;

  constructor(
    private readonly rpId: string,
    private readonly origin: string,
    options: { counter?: number } = {},
  ) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    this.privateKey = privateKey;
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    this.publicJwk = { x: jwk.x, y: jwk.y };
    this.credentialId = b64url(randomBytes(32));
    this.counter = options.counter ?? 1;
  }

  /** A RegistrationResponseJSON answering `challenge`. */
  attest(challenge: string, overrides: CeremonyOverrides = {}) {
    const coseKey = new Map<Cbor, Cbor>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(this.publicJwk.x, 'base64url')],
      [-3, Buffer.from(this.publicJwk.y, 'base64url')],
    ]);
    const credentialId = Buffer.from(this.credentialId, 'base64url');
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16BE(credentialId.length);
    const authData = Buffer.concat([
      this.authDataHead(overrides, FLAG_AT, overrides.counter ?? 0),
      Buffer.alloc(16), // AAGUID: none
      idLength,
      credentialId,
      encodeCbor(coseKey),
    ]);
    const attestationObject = encodeCbor(
      new Map<Cbor, Cbor>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]),
    );
    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key' as const,
      response: {
        clientDataJSON: this.clientData('webauthn.create', challenge, overrides),
        attestationObject: b64url(attestationObject),
        transports: ['internal'],
      },
      authenticatorAttachment: 'platform' as const,
      clientExtensionResults: {},
    };
  }

  /** An AuthenticationResponseJSON answering `challenge`; moves the counter on unless overridden. */
  assert(challenge: string, overrides: CeremonyOverrides = {}, userHandle?: string) {
    const counter = overrides.counter ?? this.counter;
    if (overrides.counter === undefined && this.counter > 0) this.counter += 1;
    const authenticatorData = this.authDataHead(overrides, 0, counter);
    const clientDataJSON = this.clientData('webauthn.get', challenge, overrides);
    const signature = sign(
      'sha256',
      Buffer.concat([authenticatorData, sha256(Buffer.from(clientDataJSON, 'base64url'))]),
      this.privateKey,
    );
    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key' as const,
      response: {
        clientDataJSON,
        authenticatorData: b64url(authenticatorData),
        signature: b64url(signature),
        ...(userHandle ? { userHandle } : {}),
      },
      authenticatorAttachment: 'platform' as const,
      clientExtensionResults: {},
    };
  }

  private authDataHead(overrides: CeremonyOverrides, extraFlags: number, counter: number): Buffer {
    const signCount = Buffer.alloc(4);
    signCount.writeUInt32BE(counter);
    return Buffer.concat([
      sha256(overrides.rpId ?? this.rpId),
      Buffer.from([(overrides.flags ?? FLAG_UP | FLAG_UV) | extraFlags]),
      signCount,
    ]);
  }

  private clientData(type: string, challenge: string, overrides: CeremonyOverrides): string {
    return b64url(
      Buffer.from(
        JSON.stringify({
          type: overrides.type ?? type,
          challenge: overrides.challenge ?? challenge,
          origin: overrides.origin ?? this.origin,
          crossOrigin: false,
        }),
      ),
    );
  }
}
