import { describe, expect, it } from 'vitest';

import { messages } from '../i18n/messages';
import {
  canAccessTeam,
  getAppEntry,
  learnerTabs,
  type MobileRole,
} from './capabilities';

describe('native navigation capabilities', () => {
  it('keeps the learner tab bar on six frontline destinations', () => {
    expect(learnerTabs.map((tab) => tab.key)).toEqual(['today', 'learn', 'docs', 'ask', 'inbox', 'me']);
  });

  it('has a French and English label for every tab', () => {
    for (const tab of learnerTabs) {
      expect(messages.en[tab.labelKey]).toBeTruthy();
      expect(messages.fr[tab.labelKey]).toBeTruthy();
    }
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
