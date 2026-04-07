import { z } from 'zod';

const safeString = z
  .string()
  .refine((val) => !/[;|`$(){}< >\n\\]/.test(val), {
    message: 'Contains forbidden characters',
  });

export const intentBody = z
  .object({
    action: safeString.optional(),
    data: safeString.optional(),
    component: safeString.optional(),
    category: safeString.optional(),
    extras: z
      .array(
        z.object({
          type: z.enum(['string', 'int', 'bool', 'float', 'long']),
          key: safeString,
          value: safeString,
        })
      )
      .optional(),
    flags: safeString.optional(),
  })
  .refine((val) => val.action || val.data || val.component, {
    message: 'At least one of action, data, or component is required',
  });
