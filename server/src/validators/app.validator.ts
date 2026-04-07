import { z } from 'zod';

export const appTypeQuery = z.object({
  type: z.enum(['system', 'user', 'preinstalled', 'all']).default('all'),
});

export const packageNameParam = z.object({
  serial: z.string().regex(/^[a-zA-Z0-9.:_-]+$/),
  packageName: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.]*$/, 'Invalid package name'),
});
