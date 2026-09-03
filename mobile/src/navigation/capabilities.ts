import type { MessageKey } from '../i18n/messages';

export type MobileRole =
  | 'AGENT'
  | 'SUPERVISOR'
  | 'MANAGER'
  | 'HR'
  | 'PLATFORM_MANAGER'
  | 'SUPER_ADMIN';

// Learner tab bar, mirroring the web mobile nav (Accueil · Formations · Données · Top)
// plus the assistant, and shaped by Jakob's Law: at most five tabs, Home first,
// and everything about the account (profile, career paths, certificates,
// department, settings, sign-out) behind the avatar in the top-right corner.
// Announcements sit behind the bell next to it. Labels are message keys so the
// bar renders in the device language.
export const learnerTabs = [
  { key: 'today', labelKey: 'tabs.today' },
  { key: 'learn', labelKey: 'tabs.learn' },
  { key: 'data', labelKey: 'tabs.data' },
  { key: 'ask', labelKey: 'tabs.ask' },
  { key: 'top', labelKey: 'tabs.top' },
] as const satisfies ReadonlyArray<{ key: string; labelKey: MessageKey }>;

export const MAX_TABS = 5;

export type LearnerTabKey = (typeof learnerTabs)[number]['key'];

export function canAccessTeam(role: MobileRole) {
  return role !== 'AGENT';
}

export function getAppEntry(status: 'checking' | 'signedOut' | 'authenticated') {
  if (status === 'checking') return null;
  return status === 'signedOut' ? '/(auth)/sign-in' : '/(tabs)/today';
}
