import { z } from 'zod';

export const portForwardBody = z.object({
  localPort: z.number().int().min(1).max(65535),
  remotePort: z.number().int().min(1).max(65535),
});

export const removeForwardBody = z.object({
  localPort: z.number().int().min(1).max(65535),
});

export const removeReverseBody = z.object({
  remotePort: z.number().int().min(1).max(65535),
});
