import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { seedPublicDemo } from '../src/modules/workspaces/demo-workspace/public-demo/public-demo.seeder';

/**
 * Fills a fresh public demo instance (see website/docs/deployment/demo.md).
 * Reads the shared account from DEMO_USER_EMAIL / DEMO_USER_PASSWORD, the
 * same variables the login page offers. Does nothing when the account exists:
 * the nightly reset empties the database before it runs this.
 */
async function main(): Promise<void> {
  const email = process.env.DEMO_USER_EMAIL?.trim();
  const password = process.env.DEMO_USER_PASSWORD;
  if (!(email && password)) {
    throw new Error('Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD');
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    await seedPublicDemo(app, { email, password });
  } finally {
    await app.close();
  }
}

main().catch(error => {
  console.error('Seeding the public demo failed:', error);
  process.exit(1);
});
