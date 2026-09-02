import type { MessageKey } from '../i18n/messages';

export type MobileRole =
  | 'AGENT'
  | 'SUPERVISOR'
  | 'MANAGER'
  | 'HR'
  | 'PLATFORM_MANAGER'
  | 'SUPER_ADMIN';

// Learner tab bar. Labels are message keys so the bar renders in the device language.
export const learnerTabs = [
  { key: 'today', labelKey: 'tabs.today' },
  { key: 'learn', labelKey: 'tabs.learn' },
  { key: 'docs', labelKey: 'tabs.docs' },
  { key: 'ask', labelKey: 'tabs.ask' },
  { key: 'inbox', labelKey: 'tabs.inbox' },
  { key: 'me', labelKey: 'tabs.me' },
] as const satisfies ReadonlyArray<{ key: string; labelKey: MessageKey }>;

export type LearnerTabKey = (typeof learnerTabs)[number]['key'];

export function canAccessTeam(role: MobileRole) {
  return role !== 'AGENT';
}

export function getAppEntry(status: 'checking' | 'signedOut' | 'authenticated') {
  if (status === 'checking') return null;
  return status === 'signedOut' ? '/(auth)/sign-in' : '/(tabs)/today';
}
