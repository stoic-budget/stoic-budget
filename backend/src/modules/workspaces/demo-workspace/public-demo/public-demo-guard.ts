import type { DataSource } from 'typeorm';
import { isDemoMode } from '../../../../common/demo/demo-mode';
import { DEV_DEFAULTS } from '../../../../common/utils/dev-defaults';

/**
 * Why `seed:public-demo` must not run on this instance, or null when it may.
 * The seed makes an active account whose password the login page publishes,
 * so it runs only on a demo instance (`DEMO_MODE=true`) whose users table
 * holds nobody but that account. Outside production the backend makes the
 * dev admin on every start (AuthDevBootstrapService), so there it does not
 * count; the demo deployment runs in production and has no such account.
 */
export async function publicDemoRefusal(
  dataSource: Pick<DataSource, 'query'>,
  demoEmail: string,
): Promise<string | null> {
  if (!isDemoMode()) {
    return 'DEMO_MODE is not true: seed:public-demo only fills a public demo instance';
  }
  const allowed = [demoEmail.trim().toLowerCase()];
  if (process.env.NODE_ENV !== 'production') {
    allowed.push(DEV_DEFAULTS.ADMIN_EMAIL);
  }
  const [{ count }]: Array<{ count: string }> = await dataSource.query(
    'SELECT count(*) FROM users WHERE NOT (lower(email) = ANY($1))',
    [allowed],
  );
  const others = Number(count);
  return others > 0
    ? `The instance has ${others} other account(s): seed:public-demo only fills an empty demo instance`
    : null;
}
