import { Router, Request, Response, NextFunction } from 'express';
import { networkService } from '../services/network.service';
import { deviceGuard } from '../middleware/device-guard';
import { validate } from '../middleware/validate';
import { wifiBody, proxyBody } from '../validators/network.validator';

const router = Router();

router.get(
  '/:serial/network/wifi',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const status = await networkService.getWifiStatus(serial);
      res.json({ data: status });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/network/wifi',
  deviceGuard,
  validate(wifiBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      await networkService.setWifi(serial, req.body.enabled);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:serial/network/proxy',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const proxy = await networkService.getProxy(serial);
      res.json({ data: proxy });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:serial/network/proxy',
  deviceGuard,
  validate(proxyBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      await networkService.setProxy(serial, req.body);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:serial/network/proxy',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      await networkService.clearProxy(serial);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
