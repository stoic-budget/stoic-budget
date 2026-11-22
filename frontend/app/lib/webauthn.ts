import type {
  PasskeyAssertion,
  PasskeyAttestation,
  PasskeyCreationOptions,
  PasskeyRequestOptions,
} from '@/app/lib/contracts';

/**
 * The browser side of passkeys: `navigator.credentials` with the base64url
 * conversions WebAuthn's JSON needs. The server checks everything; this only
 * carries bytes across.
 */

export const toBase64Url = (buffer: ArrayBuffer): string => {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const fromBase64Url = (value: string): ArrayBuffer => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

/** Whether this browser can use passkeys at all. */
export const passkeysSupported = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.PublicKeyCredential === 'function' &&
  typeof navigator.credentials?.get === 'function';

/** The person closed or timed out the browser's prompt: not an error worth a message of its own. */
export const isPasskeyPromptDismissed = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'NotAllowedError' || error.name === 'AbortError');

const descriptors = (list: PasskeyRequestOptions['allowCredentials']) =>
  list.map(item => ({
    id: fromBase64Url(item.id),
    type: item.type,
    ...(item.transports ? { transports: item.transports as AuthenticatorTransport[] } : {}),
  }));

const attachment = (value: string | null): 'platform' | 'cross-platform' | null =>
  value === 'platform' || value === 'cross-platform' ? value : null;

/** Asks the browser for a new passkey and answers it in the shape the server reads. */
export async function createPasskey(options: PasskeyCreationOptions): Promise<PasskeyAttestation> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: fromBase64Url(options.challenge),
      rp: options.rp,
      user: { ...options.user, id: fromBase64Url(options.user.id) },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      excludeCredentials: descriptors(options.excludeCredentials),
      authenticatorSelection: options.authenticatorSelection,
      attestation: options.attestation,
    },
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new DOMException('No passkey was created', 'NotAllowedError');
  }
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: 'public-key',
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      attestationObject: toBase64Url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
    authenticatorAttachment: attachment(credential.authenticatorAttachment),
    clientExtensionResults: {},
  };
}

/** Asks the browser to sign `options.challenge` with a passkey. */
export async function getPasskey(options: PasskeyRequestOptions): Promise<PasskeyAssertion> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: fromBase64Url(options.challenge),
      rpId: options.rpId,
      timeout: options.timeout,
      userVerification: options.userVerification,
      allowCredentials: descriptors(options.allowCredentials),
    },
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new DOMException('No passkey was chosen', 'NotAllowedError');
  }
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: 'public-key',
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
    },
    authenticatorAttachment: attachment(credential.authenticatorAttachment),
    clientExtensionResults: {},
  };
}
