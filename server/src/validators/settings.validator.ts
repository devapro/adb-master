import { z } from 'zod';

const safeString = z
  .string()
  .min(1)
  .max(500)
  .refine((val) => !/[;|`$(){}<>\n\\]/.test(val), {
    message: 'Contains forbidden characters',
  });

export const namespaceParam = z.object({
  namespace: z.enum(['system', 'secure', 'global']),
  serial: z.string(),
});

export const settingBody = z.object({
  key: safeString,
  value: z.string().min(0).max(1000).refine((val) => !/[;|`$(){}<>\n\\]/.test(val), {
    message: 'Contains forbidden characters',
  }),
});

export const settingKeyParam = z.object({
  namespace: z.enum(['system', 'secure', 'global']),
  serial: z.string(),
  key: safeString,
});
