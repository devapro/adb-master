import { z } from 'zod';

export const shellCommandBody = z.object({
  command: z.string().min(1).max(4096),
});
