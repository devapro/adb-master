import { Router, Request, Response, NextFunction } from 'express';
import { logcatService } from '../services/logcat.service';
import { deviceGuard } from '../middleware/device-guard';

const router = Router();

router.get(
  '/:serial/logcat/snapshot',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const lines = Number(req.query.lines) || 500;
      const snapshot = await logcatService.getSnapshot(serial, lines);
      res.json({ data: snapshot });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/logcat/clear',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      await logcatService.clearLogcat(serial);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
