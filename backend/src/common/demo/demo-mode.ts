/**
 * A public demo instance (`DEMO_MODE=true`): anyone may sign in with the
 * shared demo account and look around, nobody may change anything. The data
 * is reseeded from a script, never over HTTP.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE?.trim().toLowerCase() === 'true';
}

/** The shared demo account a demo instance offers on its login page, or null when it offers none. */
export function demoCredentials(): { email: string; password: string } | null {
  const email = process.env.DEMO_USER_EMAIL?.trim();
  const password = process.env.DEMO_USER_PASSWORD;
  if (!(isDemoMode() && email && password)) {
    return null;
  }
  return { email, password };
}

type SessionOrigin = {
  ipAddress: string | null;
  userAgent?: string | null;
  device: string;
  browser: string;
  os: string;
};

/**
 * A session as the sessions list and the account export show it. On a demo
 * every visitor signs in as the one shared account, so each would see the
 * others' addresses and browsers: there a session shows none, whatever an
 * older row still holds.
 */
export function shownSession<T extends SessionOrigin>(session: T): T {
  if (!isDemoMode()) {
    return session;
  }
  return {
    ...session,
    ipAddress: null,
    ...('userAgent' in session ? { userAgent: null } : {}),
    device: 'Unknown device',
    browser: 'Unknown browser',
    os: 'Unknown OS',
  };
}
