export type MobileRole =
  | 'AGENT'
  | 'SUPERVISOR'
  | 'MANAGER'
  | 'HR'
  | 'PLATFORM_MANAGER'
  | 'SUPER_ADMIN';

export const learnerTabs = [
  { key: 'today', label: 'Today' },
  { key: 'learn', label: 'Learn' },
  { key: 'ask', label: 'Ask' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'me', label: 'Me' },
] as const;

export function canAccessTeam(role: MobileRole) {
  return role !== 'AGENT';
}

export function getAppEntry(status: 'checking' | 'signedOut' | 'authenticated') {
  if (status === 'checking') return null;
  return status === 'signedOut' ? '/(auth)/sign-in' : '/(tabs)/today';
}
