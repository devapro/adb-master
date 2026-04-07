import { z } from 'zod';

const hostPattern = /^[a-zA-Z0-9._-]+$/;

export const connectBody = z.object({
  host: z.string().min(1).regex(hostPattern),
  port: z.number().int().min(1).max(65535).default(5555),
});

export const disconnectBody = z.object({
  address: z.string().min(1),
});
