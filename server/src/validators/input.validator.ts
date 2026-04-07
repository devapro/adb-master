import { z } from 'zod';

const ALLOWED_KEYCODES = [
  3, 4, 5, 6, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54,
  55, 56, 57, 58, 59, 60, 61, 62, 66, 67, 82, 84, 85, 86, 87, 88, 89,
  90, 91, 92, 93, 111, 120, 122, 123, 124, 125, 126, 127, 164, 176, 187,
  207, 208, 209, 210, 211, 219, 220, 221, 277,
];

export const textInputBody = z.object({
  text: z
    .string()
    .min(1)
    .max(500)
    .refine((val) => !/[;|`${}\\]/.test(val), {
      message: 'Contains forbidden characters',
    }),
});

export const tapInputBody = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
});

export const swipeInputBody = z.object({
  x1: z.number().min(0),
  y1: z.number().min(0),
  x2: z.number().min(0),
  y2: z.number().min(0),
  duration: z.number().min(0).max(10000).optional(),
});

export const keyEventBody = z.object({
  keycode: z.union([
    z.number().refine((val) => ALLOWED_KEYCODES.includes(val), {
      message: 'Invalid keycode',
    }),
    z.string().regex(/^[A-Z_]+$/, 'Invalid keycode name'),
  ]),
});
