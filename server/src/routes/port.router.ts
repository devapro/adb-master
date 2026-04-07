import { Router, Request, Response, NextFunction } from 'express';
import { portService } from '../services/port.service';
import { deviceGuard } from '../middleware/device-guard';
import { validate } from '../middleware/validate';
import { portForwardBody, removeForwardBody, removeReverseBody } from '../validators/port.validator';

const router = Router();

router.get(
  '/:serial/ports',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const [forwards, reverses] = await Promise.all([
        portService.listForwards(serial),
        portService.listReverses(serial),
      ]);
      res.json({ data: { forwards, reverses } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/ports/forward',
  deviceGuard,
  validate(portForwardBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      await portService.addForward(serial, req.body.localPort, req.body.remotePort);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:serial/ports/forward',
  deviceGuard,
  validate(removeForwardBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      await portService.removeForward(serial, req.body.localPort);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/ports/reverse',
  deviceGuard,
  validate(portForwardBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      await portService.addReverse(serial, req.body.localPort, req.body.remotePort);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:serial/ports/reverse',
  deviceGuard,
  validate(removeReverseBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      await portService.removeReverse(serial, req.body.remotePort);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
