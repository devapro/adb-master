import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { appService } from '../services/app.service';
import { deviceGuard } from '../middleware/device-guard';
import { validate } from '../middleware/validate';
import { appTypeQuery, packageNameParam, permissionBody } from '../validators/app.validator';
import { config } from '../config';

const router = Router();

fs.mkdirSync(config.uploadDir, { recursive: true });

const abUpload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: config.maxUploadSize },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.ab') {
      cb(new Error('Only .ab files are allowed'));
      return;
    }
    cb(null, true);
  },
});

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

router.post(
  '/:serial/apps/:packageName/clear',
  deviceGuard,
  validate(packageNameParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;
      const result = await appService.clearData(serial, packageName);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/apps/:packageName/clear-cache',
  deviceGuard,
  validate(packageNameParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;
      const result = await appService.clearCache(serial, packageName);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/apps/:packageName/launch',
  deviceGuard,
  validate(packageNameParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;
      const result = await appService.launchApp(serial, packageName);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:serial/apps/:packageName/permissions',
  deviceGuard,
  validate(packageNameParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;
      const permissions = await appService.getPermissions(serial, packageName);
      res.json({ data: permissions });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/apps/:packageName/permissions/grant',
  deviceGuard,
  validate(packageNameParam, 'params'),
  validate(permissionBody, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;
      const { permission } = req.body;
      const result = await appService.grantPermission(serial, packageName, permission);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/apps/:packageName/permissions/revoke',
  deviceGuard,
  validate(packageNameParam, 'params'),
  validate(permissionBody, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;
      const { permission } = req.body;
      const result = await appService.revokePermission(serial, packageName, permission);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:serial/apps/:packageName/apk',
  deviceGuard,
  validate(packageNameParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    let localPath: string | null = null;
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;
      const apkPath = await appService.getApkPath(serial, packageName);

      fs.mkdirSync(config.uploadDir, { recursive: true });
      localPath = path.join(config.uploadDir, `${packageName}-${Date.now()}.apk`);

      await appService.pullApk(serial, apkPath, localPath);

      res.setHeader('Content-Disposition', `attachment; filename="${packageName}.apk"`);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');

      const stream = fs.createReadStream(localPath);
      stream.pipe(res);
      stream.on('end', () => {
        if (localPath) fs.unlink(localPath, () => {});
      });
      stream.on('error', (err) => {
        if (localPath) fs.unlink(localPath, () => {});
        next(err);
      });
    } catch (err) {
      if (localPath) fs.unlink(localPath, () => {});
      next(err);
    }
  }
);

router.get(
  '/:serial/apps/:packageName/backup',
  deviceGuard,
  validate(packageNameParam, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    let localPath: string | null = null;
    try {
      const serial = req.params.serial as string;
      const packageName = req.params.packageName as string;

      fs.mkdirSync(config.uploadDir, { recursive: true });
      localPath = path.join(config.uploadDir, `${packageName}-${Date.now()}.ab`);

      const success = await appService.backupApp(serial, packageName, localPath);
      if (!success) {
        if (localPath) fs.unlink(localPath, () => {});
        res.status(500).json({ error: 'Backup failed or was rejected on device', code: 500 });
        return;
      }

      res.setHeader('Content-Disposition', `attachment; filename="${packageName}.ab"`);
      res.setHeader('Content-Type', 'application/octet-stream');

      const stream = fs.createReadStream(localPath);
      stream.pipe(res);
      stream.on('end', () => {
        if (localPath) fs.unlink(localPath, () => {});
      });
      stream.on('error', (err) => {
        if (localPath) fs.unlink(localPath, () => {});
        next(err);
      });
    } catch (err) {
      if (localPath) fs.unlink(localPath, () => {});
      next(err);
    }
  }
);

router.post(
  '/:serial/apps/:packageName/restore',
  deviceGuard,
  validate(packageNameParam, 'params'),
  abUpload.single('backup'),
  async (req: Request, res: Response, next: NextFunction) => {
    const filePath = req.file?.path;
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No .ab backup file provided', code: 400 });
        return;
      }

      const serial = req.params.serial as string;
      const result = await appService.restoreApp(serial, filePath!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    } finally {
      if (filePath) fs.unlink(filePath, () => {});
    }
  }
);

export default router;
