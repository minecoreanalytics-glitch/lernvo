import { describe, expect, it } from 'vitest';

import { messages, resolveLocale, translate, type MessageKey } from './messages';

describe('message catalogue', () => {
  it('ships every English key in French too', () => {
    const en = Object.keys(messages.en).sort();
    const fr = Object.keys(messages.fr).sort();
    expect(fr).toEqual(en);
  });

  it('keeps the same placeholders in both languages', () => {
    for (const key of Object.keys(messages.en) as MessageKey[]) {
      const vars = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
      expect(vars(messages.fr[key]), key).toEqual(vars(messages.en[key]));
    }
  });

  it('interpolates variables and leaves unknown placeholders visible', () => {
    expect(translate('en', 'today.greeting', { name: 'Ana' })).toBe('Good day, Ana');
    expect(translate('fr', 'today.greeting', { name: 'Ana' })).toBe('Bonjour, Ana');
    expect(translate('fr', 'team.summary', { count: 4 })).toBe('4 personnes · {overdue} avec des formations en retard');
  });

  it('maps device language codes to a supported locale', () => {
    expect(resolveLocale('fr')).toBe('fr');
    expect(resolveLocale('fr-CA')).toBe('fr');
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('ht')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});
