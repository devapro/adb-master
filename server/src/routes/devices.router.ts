import { Router, Request, Response, NextFunction } from 'express';
import { deviceService } from '../services/device.service';
import { validate } from '../middleware/validate';
import { deviceGuard } from '../middleware/device-guard';
import { connectBody, disconnectBody } from '../validators/wireless.validator';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const devices = await deviceService.getDevices();
    res.json({ data: devices });
  } catch (err) {
    next(err);
  }
});

router.post('/connect', validate(connectBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { host, port } = req.body;
    const result = await deviceService.connectDevice(host, port);
    if (!result.success) {
      res.status(400).json({ error: result.message, code: 400 });
      return;
    }
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/disconnect', validate(disconnectBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body;
    const result = await deviceService.disconnectDevice(address);
    if (!result.success) {
      res.status(400).json({ error: result.message, code: 400 });
      return;
    }
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:serial/tcpip', deviceGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serial = req.params.serial as string;
    const port = req.body.port ?? 5555;
    const result = await deviceService.enableTcpip(serial, port);
    if (!result.success) {
      res.status(400).json({ error: result.message, code: 400 });
      return;
    }
    res.json({ data: result });
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
