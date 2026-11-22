import { type INestApplicationContext, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EffectRuntime } from '../../../../common/effect/effect-runtime';
import { hashPassword } from '../../../../common/utils/password-hash.util';
import { User, UserRole } from '../../../../entities/user.entity';
import { Workspace } from '../../../../entities/workspace.entity';
import { BusinessProfileService } from '../../../business-profile/business-profile.service';
import { CryptoImportService } from '../../../crypto/crypto-import.service';
import { CryptoPriceService } from '../../../crypto/crypto-price.service';
import { InsightsService } from '../../../insights/insights.service';
import { ClientsService } from '../../../invoices/clients.service';
import { InvoicesService } from '../../../invoices/invoices.service';
import { PayablesService } from '../../../payables/payables.service';
import { ReceiptsService } from '../../../receipts/receipts.service';
import { CURRENT_DISCLAIMER_VERSION } from '../../../users/disclaimer.constant';
import { DemoWorkspaceService, demoAnchorDate } from '../demo-workspace.service';
import { seedDemoBusiness } from './demo-business';
import { seedDemoCrypto } from './demo-crypto';
import { seedDemoReceipts } from './demo-receipts';

/** The studio the generator invents; also the name on its invoices. */
export const PUBLIC_DEMO_WORKSPACE_NAME = 'Fjordline Design Studio';

/**
 * Fills an empty public demo instance: the shared account visitors sign in
 * with, its one workspace (the in-app demo's twelve months), and what the
 * in-app demo leaves empty: invoices and bills, a crypto account, receipts.
 * The account has seen the welcome window and accepted the disclaimer, since
 * nothing a visitor does is saved. Returns false when a finished seed is there.
 *
 * The account is made inactive and switched on as the very last step, so an
 * active account means a finished seed and visitors never sign in to half of
 * one. When an earlier run died midway, the inactive account's workspaces are
 * deleted (everything in them cascades) and the seed starts over.
 */
export async function seedPublicDemo(
  app: INestApplicationContext,
  account: { email: string; password: string },
): Promise<boolean> {
  const logger = new Logger('PublicDemo');
  const get = <T>(type: new (...args: never[]) => T): T => app.get(type, { strict: false });
  const dataSource = get(DataSource);
  const users = dataSource.getRepository(User);
  const email = account.email.trim().toLowerCase();
  const existing = await users.findOne({ where: { email }, select: { id: true, isActive: true } });
  if (existing?.isActive) {
    logger.log(`${email} exists; nothing to do`);
    return false;
  }
  if (existing) {
    logger.warn(`${email} was left half-seeded; deleting its workspaces and seeding again`);
    await dataSource.getRepository(Workspace).delete({ ownerId: existing.id });
  }

  const now = new Date();
  const user = await users.save(
    users.create({
      id: existing?.id,
      email,
      passwordHash: await hashPassword(account.password),
      name: 'Demo visitor',
      role: UserRole.USER,
      isActive: false,
      permissions: null,
      onboardingCompletedAt: now,
      disclaimerAcceptedAt: now,
      disclaimerVersion: CURRENT_DISCLAIMER_VERSION,
      welcomeTutorialSeenAt: now,
    }),
  );
  const { workspace } = await get(DemoWorkspaceService).getOrCreate(
    user.id,
    PUBLIC_DEMO_WORKSPACE_NAME,
  );
  await users.update(user.id, { workspaceId: workspace.id, lastWorkspaceId: workspace.id });

  const ids = { workspaceId: workspace.id, userId: user.id };
  const anchor = demoAnchorDate(now);
  await seedDemoBusiness(
    {
      dataSource,
      businessProfile: get(BusinessProfileService),
      clients: get(ClientsService),
      invoices: get(InvoicesService),
      payables: get(PayablesService),
    },
    ids,
    anchor,
  );
  await seedDemoCrypto(
    { cryptoImport: get(CryptoImportService), cryptoPrice: get(CryptoPriceService) },
    ids,
    anchor,
  );
  const receipts = await seedDemoReceipts(
    { dataSource, effects: get(EffectRuntime), receipts: get(ReceiptsService) },
    ids,
    anchor,
  );
  // The advice a visitor reads is written now: the demo refuses a refresh.
  await get(InsightsService).refresh(user.id, workspace.id, { locale: 'en' });
  // Last: an active account is how a rerun knows the seed finished.
  await users.update(user.id, { isActive: true });
  logger.log(`Seeded ${email}: workspace ${workspace.id}, ${receipts} receipts`);
  return true;
}
