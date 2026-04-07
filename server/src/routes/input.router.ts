import { Router, Request, Response, NextFunction } from 'express';
import { inputService } from '../services/input.service';
import { deviceGuard } from '../middleware/device-guard';
import { validate } from '../middleware/validate';
import { textInputBody, tapInputBody, swipeInputBody, keyEventBody } from '../validators/input.validator';

const router = Router();

router.post(
  '/:serial/input/text',
  deviceGuard,
  validate(textInputBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const success = await inputService.sendText(serial, req.body.text);
      res.json({ data: { success } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/input/tap',
  deviceGuard,
  validate(tapInputBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const { x, y } = req.body;
      const success = await inputService.sendTap(serial, x, y);
      res.json({ data: { success } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/input/swipe',
  deviceGuard,
  validate(swipeInputBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const { x1, y1, x2, y2, duration } = req.body;
      const success = await inputService.sendSwipe(serial, x1, y1, x2, y2, duration);
      res.json({ data: { success } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/input/keyevent',
  deviceGuard,
  validate(keyEventBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const success = await inputService.sendKeyEvent(serial, req.body.keycode);
      res.json({ data: { success } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
