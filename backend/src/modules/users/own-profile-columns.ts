import type { FindOptionsSelect } from 'typeorm';
import type { User } from '../../entities/user.entity';

/**
 * What the own-profile changes load (preferences, avatar, onboarding, e-mail and
 * password): every column `toCurrentUser` answers, since the client stores that
 * answer as its user, plus the password hash and token version they check.
 */
export const OWN_PROFILE_COLUMNS: FindOptionsSelect<User> = {
  id: true,
  email: true,
  passwordHash: true,
  name: true,
  company: true,
  role: true,
  workspaceId: true,
  telegramId: true,
  telegramChatId: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
  isActive: true,
  permissions: true,
  locale: true,
  timeZone: true,
  dateFormat: true,
  firstDayOfWeek: true,
  uiDensity: true,
  reduceMotion: true,
  showDailyQuote: true,
  roundAmounts: true,
  themePreference: true,
  mapStylePreference: true,
  avatarUrl: true,
  onboardingCompletedAt: true,
  disclaimerAcceptedAt: true,
  disclaimerVersion: true,
  welcomeTutorialSeenAt: true,
  pageHintsSeen: true,
  changelogSeenId: true,
  changelogSeenAt: true,
  tokenVersion: true,
};
