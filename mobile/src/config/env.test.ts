import { describe, expect, it } from 'vitest';

import { parsePublicEnvironment } from './env';

describe('parsePublicEnvironment', () => {
  it('rejects a missing API URL before the app starts', () => {
    expect(() => parsePublicEnvironment({})).toThrow('EXPO_PUBLIC_API_URL');
  });

  it.each(['lernvo.example.com', 'ftp://api.lernvo.com', 'javascript:alert(1)'])(
    'rejects unsafe API URL %s',
    (apiUrl) => {
      expect(() =>
        parsePublicEnvironment({ EXPO_PUBLIC_API_URL: apiUrl }),
      ).toThrow('EXPO_PUBLIC_API_URL');
    },
  );

  it('normalizes a valid API URL without a trailing slash', () => {
    expect(
      parsePublicEnvironment({
        EXPO_PUBLIC_API_URL: 'https://staging-api.lernvo.com/',
      }),
    ).toEqual({ apiUrl: 'https://staging-api.lernvo.com' });
  });

  it('allows HTTP only for local development hosts', () => {
    expect(
      parsePublicEnvironment({ EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3000/' }),
    ).toEqual({ apiUrl: 'http://127.0.0.1:3000' });

    expect(() =>
      parsePublicEnvironment({ EXPO_PUBLIC_API_URL: 'http://api.lernvo.com' }),
    ).toThrow('EXPO_PUBLIC_API_URL');
  });
});
