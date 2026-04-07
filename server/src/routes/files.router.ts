import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileService } from '../services/file.service';
import { deviceGuard } from '../middleware/device-guard';
import { validate } from '../middleware/validate';
import { fileQuery, deleteFileBody } from '../validators/file.validator';
import { config } from '../config';

const router = Router();

fs.mkdirSync(config.uploadDir, { recursive: true });

const fileUpload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}-${file.originalname}`);
    },
  }),
  limits: { fileSize: config.maxUploadSize },
});

router.get(
  '/:serial/files',
  deviceGuard,
  validate(fileQuery, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const files = await fileService.listFiles(
        serial,
        req.query.path as string,
        Number(req.query.minSize) || 0
      );
      res.json({ data: files });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:serial/files/large',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const files = await fileService.getLargeFiles(
        serial,
        (req.query.path as string) || '/sdcard',
        Number(req.query.limit) || 50
      );
      res.json({ data: files });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:serial/storage',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const summary = await fileService.getStorageSummary(serial);
      res.json({ data: summary });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/files/upload',
  deviceGuard,
  fileUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    const filePath = req.file?.path;
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided', code: 400 });
        return;
      }

      const serial = req.params.serial as string;
      const devicePath = req.body.path;
      if (!devicePath || devicePath.includes('..')) {
        res.status(400).json({ error: 'Invalid device path', code: 400 });
        return;
      }

      const success = await fileService.pushFile(serial, filePath!, devicePath);
      res.json({ data: { success } });
    } catch (err) {
      next(err);
    } finally {
      if (filePath) fs.unlink(filePath, () => {});
    }
  }
);

router.get(
  '/:serial/files/download',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    const devicePath = req.query.path as string;
    if (!devicePath || devicePath.includes('..')) {
      res.status(400).json({ error: 'Invalid device path', code: 400 });
      return;
    }

    const localPath = path.join(
      config.uploadDir,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}-${path.basename(devicePath)}`
    );

    try {
      const serial = req.params.serial as string;
      const success = await fileService.pullFile(serial, devicePath, localPath);

      if (!success) {
        res.status(404).json({ error: 'Failed to pull file from device', code: 404 });
        return;
      }

      const fileName = path.basename(devicePath);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');

      const stream = fs.createReadStream(localPath);
      stream.pipe(res);
      stream.on('end', () => fs.unlink(localPath, () => {}));
      stream.on('error', (err) => {
        fs.unlink(localPath, () => {});
        next(err);
      });
    } catch (err) {
      fs.unlink(localPath, () => {});
      next(err);
    }
  }
);

router.delete(
  '/:serial/files',
  deviceGuard,
  validate(deleteFileBody, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const { path, isDirectory } = req.body;
      const success = isDirectory
        ? await fileService.deleteDirectory(serial, path)
        : await fileService.deleteFile(serial, path);
      res.json({ data: { success } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
