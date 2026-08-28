import { describe, expect, it } from 'vitest';

import {
  canAccessTeam,
  getAppEntry,
  learnerTabs,
  type MobileRole,
} from './capabilities';

describe('native navigation capabilities', () => {
  it('keeps the learner tab bar focused on five frontline destinations', () => {
    expect(learnerTabs).toEqual([
      { key: 'today', label: 'Today' },
      { key: 'learn', label: 'Learn' },
      { key: 'ask', label: 'Ask' },
      { key: 'inbox', label: 'Inbox' },
      { key: 'me', label: 'Me' },
    ]);
  });

  it.each<MobileRole>(['SUPERVISOR', 'MANAGER', 'HR', 'PLATFORM_MANAGER', 'SUPER_ADMIN'])(
    'allows %s to open Team',
    (role) => expect(canAccessTeam(role)).toBe(true),
  );

  it('rejects Team access for an individual learner', () => {
    expect(canAccessTeam('AGENT')).toBe(false);
  });

  it('routes cold starts according to authentication state', () => {
    expect(getAppEntry('checking')).toBeNull();
    expect(getAppEntry('signedOut')).toBe('/(auth)/sign-in');
    expect(getAppEntry('authenticated')).toBe('/(tabs)/today');
  });
});
