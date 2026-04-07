import { Router, Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service';
import { deviceGuard } from '../middleware/device-guard';
import { validate } from '../middleware/validate';
import { namespaceParam, settingBody, settingKeyParam } from '../validators/settings.validator';
import { SettingsNamespace } from '../types';

const router = Router();

router.get(
  '/:serial/settings/:namespace',
  deviceGuard,
  validate(namespaceParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const namespace = req.params.namespace as SettingsNamespace;
      const settings = await settingsService.listSettings(serial, namespace);
      res.json({ data: settings });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:serial/settings/:namespace',
  deviceGuard,
  validate(namespaceParam, 'params'),
  validate(settingBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const namespace = req.params.namespace as SettingsNamespace;
      const { key, value } = req.body;
      const success = await settingsService.putSetting(serial, namespace, key, value);
      res.json({ data: { success } });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:serial/settings/:namespace/:key',
  deviceGuard,
  validate(settingKeyParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const namespace = req.params.namespace as SettingsNamespace;
      const key = req.params.key as string;
      const success = await settingsService.deleteSetting(serial, namespace, key);
      res.json({ data: { success } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
