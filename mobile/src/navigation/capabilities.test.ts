import { describe, expect, it } from 'vitest';

import { messages } from '../i18n/messages';
import {
  canAccessTeam,
  getAppEntry,
  learnerTabs,
  MAX_TABS,
  type MobileRole,
} from './capabilities';

describe('native navigation capabilities', () => {
  it("follows Jakob's Law: at most five tabs, home first, profile last, primary action centred", () => {
    expect(learnerTabs.length).toBeLessThanOrEqual(MAX_TABS);
    expect(learnerTabs.map((tab) => tab.key)).toEqual(['today', 'learn', 'ask', 'inbox', 'me']);
    expect(learnerTabs[0].key).toBe('today');
    expect(learnerTabs[learnerTabs.length - 1].key).toBe('me');
    expect(learnerTabs[Math.floor(learnerTabs.length / 2)].key).toBe('ask');
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
