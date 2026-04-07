import fs from 'fs';
import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import { deviceInfoService } from '../services/device-info.service';
import { deviceGuard } from '../middleware/device-guard';
import { validate } from '../middleware/validate';
import { rebootBody } from '../validators/reboot.validator';
import { config } from '../config';

const router = Router();

router.get(
  '/:serial/info',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const data = await deviceInfoService.getDeviceInfo(serial);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:serial/bugreport',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const timestamp = Date.now();
      const filename = `bugreport-${serial}-${timestamp}.zip`;
      const localPath = path.join(config.uploadDir, filename);

      const success = await deviceInfoService.captureBugreport(serial, localPath);
      if (!success) {
        res.status(500).json({ error: 'Failed to capture bugreport' });
        return;
      }

      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);

      const stream = fs.createReadStream(localPath);
      stream.pipe(res);
      stream.on('end', () => {
        fs.unlink(localPath, () => {});
      });
      stream.on('error', (err) => {
        fs.unlink(localPath, () => {});
        next(err);
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/reboot',
  deviceGuard,
  validate(rebootBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const { mode } = req.body;
      await deviceInfoService.rebootDevice(serial, mode);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
