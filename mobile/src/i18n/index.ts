import { getLocales } from 'expo-localization';

import { resolveLocale, translate, type Locale, type MessageKey } from './messages';

// Resolved once at startup: the app follows the device language (FR or EN).
// A change of device language takes effect on the next cold start, which is
// the standard behaviour on both platforms.
export const locale: Locale = resolveLocale(getLocales()[0]?.languageCode);

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(locale, key, vars);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export type { Locale, MessageKey };
