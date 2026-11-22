import { ServiceUnavailableException } from '@nestjs/common';
import { APP_NAME } from '../../../common/brand';
import { appError } from '../../../common/errors/app-error';

export interface RelyingParty {
  /** The RP ID: the host every passkey is scoped to. */
  id: string;
  name: string;
  /** The page origins a browser answer may come from. */
  origins: string[];
}

const toOrigin = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
};

const isWithin = (origin: string, rpId: string): boolean => {
  const host = new URL(origin).hostname;
  return host === rpId || host.endsWith(`.${rpId}`);
};

/**
 * Who the passkeys are for, read only from the server's configuration: APP_URL,
 * else FRONTEND_URL. Never from the request's Host or Origin header, which the
 * caller controls; an answer signed for any other origin or RP ID is refused.
 * FRONTEND_URL counts as a second origin only when it sits on the same host.
 */
export function relyingParty(env: NodeJS.ProcessEnv = process.env): RelyingParty {
  const primary = toOrigin(env.APP_URL) ?? toOrigin(env.FRONTEND_URL);
  if (!primary) {
    throw new ServiceUnavailableException(appError('AUTH_PASSKEYS_UNAVAILABLE'));
  }
  const id = new URL(primary).hostname;
  const origins = [primary, toOrigin(env.FRONTEND_URL)].filter(
    (origin): origin is string => origin !== null && isWithin(origin, id),
  );
  return { id, name: APP_NAME, origins: [...new Set(origins)] };
}
