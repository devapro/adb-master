import { z } from 'zod';

export const rebootBody = z.object({
  mode: z.enum(['system', 'recovery', 'bootloader']).default('system'),
});
