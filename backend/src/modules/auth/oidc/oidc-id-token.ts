import { timingSafeEqual } from 'crypto';
import {
  createLocalJWKSet,
  decodeProtectedHeader,
  errors,
  type JSONWebKeySet,
  type JWTPayload,
  jwtVerify,
} from 'jose';
import { OidcRefusal } from './oidc-refusal';

/**
 * Asymmetric signatures only. `none` signs nothing, and an HMAC algorithm
 * would let anyone holding the provider's public key (everyone) sign a token
 * by using that key as the shared secret.
 */
export const ID_TOKEN_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
];

/** What the rest of the sign-in reads from a verified ID token. */
export interface IdTokenClaims {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  /** When the person last signed in at the provider (seconds), when it says. */
  authTime: number | null;
}

export interface IdTokenExpectations {
  issuer: string;
  clientId: string;
  nonce: string;
  /** The provider's keys; `fresh` refetches them, once, for a key id not seen yet. */
  keys: (fresh: boolean) => Promise<JSONWebKeySet>;
}

const invalid = () => new OidcRefusal('OIDC_TOKEN_INVALID');

const sameText = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

async function verifySignature(idToken: string, expected: IdTokenExpectations) {
  const options = {
    algorithms: ID_TOKEN_ALGORITHMS,
    issuer: expected.issuer,
    audience: expected.clientId,
    requiredClaims: ['sub', 'exp', 'iat'],
    // exp is checked by jose; this also refuses an iat far in the past or future.
    maxTokenAge: '10m',
    clockTolerance: 60,
  };
  try {
    return await jwtVerify(idToken, createLocalJWKSet(await expected.keys(false)), options);
  } catch (error) {
    // A rotated key: the cached set does not have it yet. Refetch once only.
    if (!(error instanceof errors.JWKSNoMatchingKey)) throw error;
    return jwtVerify(idToken, createLocalJWKSet(await expected.keys(true)), options);
  }
}

/** The audience rules of OpenID Connect Core §3.1.3.7 that jose leaves to the caller. */
function checkAuthorizedParty(payload: JWTPayload, clientId: string): void {
  const azp = payload.azp;
  if (azp !== undefined && (typeof azp !== 'string' || !sameText(azp, clientId))) throw invalid();
  if (Array.isArray(payload.aud) && payload.aud.length > 1 && azp === undefined) throw invalid();
}

/**
 * Checks an ID token against everything the sign-in relies on: signature
 * with the provider's keys and an allowed algorithm, issuer, audience,
 * authorized party, expiry, issue time and the nonce of this very request.
 * Any failure is the same refusal; the reason is not told to the browser.
 */
export async function verifyIdToken(
  idToken: string,
  expected: IdTokenExpectations,
): Promise<IdTokenClaims> {
  let alg: unknown;
  try {
    alg = decodeProtectedHeader(idToken).alg;
  } catch {
    throw invalid();
  }
  if (typeof alg !== 'string' || !ID_TOKEN_ALGORITHMS.includes(alg)) throw invalid();

  let payload: JWTPayload;
  try {
    ({ payload } = await verifySignature(idToken, expected));
  } catch (error) {
    if (error instanceof OidcRefusal) throw error;
    throw invalid();
  }

  checkAuthorizedParty(payload, expected.clientId);
  if (typeof payload.nonce !== 'string' || !sameText(payload.nonce, expected.nonce)) {
    throw invalid();
  }
  const subject = payload.sub;
  if (typeof subject !== 'string' || subject.length === 0 || subject.length > 255) throw invalid();

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 255) : null;
  return {
    subject,
    email: email && email.length <= 320 ? email : null,
    // Only a real boolean true counts; a string or a missing claim does not.
    emailVerified: payload.email_verified === true,
    name: name || null,
    authTime:
      typeof payload.auth_time === 'number' && Number.isFinite(payload.auth_time)
        ? payload.auth_time
        : null,
  };
}
