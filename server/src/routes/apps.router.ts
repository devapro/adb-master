import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { appService } from '../services/app.service';
import { deviceGuard } from '../middleware/device-guard';
import { validate } from '../middleware/validate';
import { appTypeQuery, packageNameParam } from '../validators/app.validator';
import { config } from '../config';

const router = Router();

fs.mkdirSync(config.uploadDir, { recursive: true });

const apkUpload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: config.maxApkSize },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.apk') {
      cb(new Error('Only .apk files are allowed'));
      return;
    }
    cb(null, true);
  },
});

router.get(
  '/:serial/apps',
  deviceGuard,
  validate(appTypeQuery, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const apps = await appService.getApps(serial, req.query.type as string);
      res.json({ data: apps });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/apps/install',
  deviceGuard,
  apkUpload.single('apk'),
  async (req: Request, res: Response, next: NextFunction) => {
    const filePath = req.file?.path;
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No APK file provided', code: 400 });
        return;
      }

      const serial = req.params.serial as string;
      const result = await appService.installApp(serial, filePath!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    } finally {
      if (filePath) fs.unlink(filePath, () => {});
    }
  }
);

router.delete(
  '/:serial/apps/:packageName',
  deviceGuard,
  validate(packageNameParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;
      const result = await appService.uninstallApp(serial, packageName);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/apps/:packageName/disable',
  deviceGuard,
  validate(packageNameParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;
      const result = await appService.disableApp(serial, packageName);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/apps/:packageName/stop',
  deviceGuard,
  validate(packageNameParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;
      const result = await appService.stopApp(serial, packageName);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
