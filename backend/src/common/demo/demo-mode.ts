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
