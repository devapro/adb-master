import { z } from 'zod';

export const serialParam = z.object({
  serial: z.string().regex(/^[a-zA-Z0-9.:_-]+$/, 'Invalid serial format'),
});
