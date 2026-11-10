import apiClient from '@/app/lib/api';
import type {
  LoginResponse,
  Passkey,
  PasskeyAssertion,
  PasskeyAttestation,
  PasskeyCreationOptions,
  PasskeyRequestOptions,
} from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

/** A passkey's label, as the server stores it (`PasskeyName`: 1 to 60 characters). */
export const PASSKEY_NAME_MAX_LENGTH = 60;

/** The signed-in person's passkeys, and the passkey sign-in. */
export const passkeysApi = {
  list(signal?: AbortSignal): Promise<Passkey[]> {
    return apiQueryDecoded({ url: '/auth/passkeys', signal, contract: 'PasskeyList' });
  },

  /** Re-checks the password and hands back what `navigator.credentials.create()` needs. */
  async registrationOptions(password: string): Promise<PasskeyCreationOptions> {
    const url = '/auth/passkeys/registration-options';
    const { data } = await apiClient.post(url, {
      password,
    } satisfies ContractInput<'PasskeyPasswordBody'>);
    return checkContract('PasskeyCreationOptions', data, url);
  },

  async register(name: string, credential: PasskeyAttestation): Promise<Passkey> {
    const { data } = await apiClient.post('/auth/passkeys', {
      name,
      credential,
    } satisfies ContractInput<'PasskeyRegistrationBody'>);
    return checkContract('Passkey', data, '/auth/passkeys');
  },

  async rename(id: string, name: string): Promise<Passkey> {
    const url = `/auth/passkeys/${id}`;
    const { data } = await apiClient.patch(url, {
      name,
    } satisfies ContractInput<'PasskeyRenameBody'>);
    return checkContract('Passkey', data, url);
  },

  async remove(id: string, password: string): Promise<void> {
    await apiClient.delete(`/auth/passkeys/${id}`, {
      data: { password } satisfies ContractInput<'PasskeyPasswordBody'>,
    });
  },

  async signInOptions(): Promise<PasskeyRequestOptions> {
    const url = '/auth/passkey-login/options';
    const { data } = await apiClient.post(url);
    return checkContract('PasskeyRequestOptions', data, url);
  },

  async signIn(credential: PasskeyAssertion): Promise<LoginResponse> {
    const { data } = await apiClient.post('/auth/passkey-login', {
      credential,
    } satisfies ContractInput<'PasskeySignInBody'>);
    return checkContract('LoginResponse', data, '/auth/passkey-login');
  },
};
