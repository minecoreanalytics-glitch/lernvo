import { z } from 'zod';

const localHosts = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

const publicEnvironmentSchema = z.object({
  EXPO_PUBLIC_API_URL: z
    .string({ required_error: 'EXPO_PUBLIC_API_URL is required' })
    .url('EXPO_PUBLIC_API_URL must be a valid URL')
    .superRefine((value, context) => {
      if (!URL.canParse(value)) {
        return;
      }

      const url = new URL(value);
      const isSecure = url.protocol === 'https:';
      const isLocalDevelopment =
        url.protocol === 'http:' && localHosts.has(url.hostname);

      if (!isSecure && !isLocalDevelopment) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'EXPO_PUBLIC_API_URL must use HTTPS outside local development',
        });
      }
    }),
});

export type PublicEnvironment = Readonly<{ apiUrl: string }>;

export function parsePublicEnvironment(
  input: Record<string, string | undefined>,
): PublicEnvironment {
  const parsed = publicEnvironmentSchema.parse(input);

  return {
    apiUrl: parsed.EXPO_PUBLIC_API_URL.replace(/\/+$/, ''),
  };
}

export function getPublicEnvironment(): PublicEnvironment {
  return parsePublicEnvironment({
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  });
}
