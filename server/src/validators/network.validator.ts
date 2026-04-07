import { z } from 'zod';

export const wifiBody = z.object({
  enabled: z.boolean(),
});

export const proxyBody = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  bypass: z.string().optional(),
});
