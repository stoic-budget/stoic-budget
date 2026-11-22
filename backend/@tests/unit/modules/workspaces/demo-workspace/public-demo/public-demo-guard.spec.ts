import { DEV_DEFAULTS } from '../../../../../../src/common/utils/dev-defaults';
import { publicDemoRefusal } from '../../../../../../src/modules/workspaces/demo-workspace/public-demo/public-demo-guard';

const demoEmail = 'visitor@example.com';

/** A users table holding these e-mails, answering the guard's count. */
function usersTable(emails: string[]) {
  return {
    query: async (_sql: string, [allowed]: [string[]]) => [
      { count: String(emails.filter(email => !allowed.includes(email.toLowerCase())).length) },
    ],
  };
}

describe('publicDemoRefusal', () => {
  const saved = { demo: process.env.DEMO_MODE, env: process.env.NODE_ENV };

  beforeEach(() => {
    process.env.DEMO_MODE = 'true';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    for (const [key, value] of [
      ['DEMO_MODE', saved.demo],
      ['NODE_ENV', saved.env],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('refuses without DEMO_MODE', async () => {
    delete process.env.DEMO_MODE;
    expect(await publicDemoRefusal(usersTable([]), demoEmail)).toMatch(/DEMO_MODE/);
    process.env.DEMO_MODE = 'false';
    expect(await publicDemoRefusal(usersTable([]), demoEmail)).toMatch(/DEMO_MODE/);
  });

  it('refuses when another account is there', async () => {
    const refusal = await publicDemoRefusal(
      usersTable([demoEmail, 'member-1@example.com']),
      demoEmail,
    );
    expect(refusal).toMatch(/1 other account/);
  });

  it('runs on an empty demo instance, and again on one holding only the demo account', async () => {
    expect(await publicDemoRefusal(usersTable([]), demoEmail)).toBeNull();
    expect(await publicDemoRefusal(usersTable([demoEmail]), ` ${demoEmail.toUpperCase()} `)).toBeNull();
  });

  it('lets the dev admin the backend makes outside production pass, and only there', async () => {
    const table = usersTable([DEV_DEFAULTS.ADMIN_EMAIL]);
    expect(await publicDemoRefusal(table, demoEmail)).toMatch(/1 other account/);
    process.env.NODE_ENV = 'development';
    expect(await publicDemoRefusal(table, demoEmail)).toBeNull();
  });
});
