import { Router, Request, Response, NextFunction } from 'express';
import { deviceService } from '../services/device.service';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const devices = await deviceService.getDevices();
    res.json({ data: devices });
  } catch (err) {
    next(err);
  }
});

router.get('/:serial', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serial = req.params.serial as string;
    const device = await deviceService.getDevice(serial);
    if (!device) {
      res.status(404).json({ error: 'Device not found', code: 404 });
      return;
    }
    res.json({ data: device });
  } catch (err) {
    next(err);
  }
});

export default router;
