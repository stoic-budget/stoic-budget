import type { FindOptionsSelect } from 'typeorm';
import type { User } from '../../entities/user.entity';

/** The columns `UsersService.findOne` loads: what a profile answer reads. */
export const USER_PROFILE_SELECT: FindOptionsSelect<User> = {
  id: true,
  email: true,
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
  themePreference: true,
  mapStylePreference: true,
  onboardingCompletedAt: true,
  disclaimerAcceptedAt: true,
  disclaimerVersion: true,
  welcomeTutorialSeenAt: true,
  pageHintsSeen: true,
  passwordSet: true,
};
