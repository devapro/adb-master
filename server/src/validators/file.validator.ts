import { z } from 'zod';

export const fileQuery = z.object({
  path: z
    .string()
    .default('/sdcard')
    .refine((p) => !p.includes('..'), 'Path traversal not allowed'),
  minSize: z.coerce.number().min(0).default(0),
});

export const deleteFileBody = z.object({
  path: z
    .string()
    .min(1)
    .refine((p) => !p.includes('..'), 'Path traversal not allowed'),
  isDirectory: z.boolean().default(false),
});
