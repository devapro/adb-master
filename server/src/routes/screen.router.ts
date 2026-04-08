import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import sharp from 'sharp';
import { screenService } from '../services/screen.service';
import { deviceGuard } from '../middleware/device-guard';

const router = Router();

router.get(
  '/:serial/screen/capture',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const buffer = await screenService.captureScreenshot(serial);
      res.set('Content-Type', 'image/png');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
);

// JPEG frame endpoint for HTTP-based streaming (used in relay mode)
router.get(
  '/:serial/screen/frame',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const quality = Math.min(100, Math.max(1, parseInt(req.query.quality as string, 10) || 70));
      const pngBuffer = await screenService.captureScreenshot(serial);
      const jpegBuffer = await sharp(pngBuffer)
        .jpeg({ quality, chromaSubsampling: '4:2:0' })
        .toBuffer();
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'no-store');
      res.send(jpegBuffer);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/screen/record/start',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      screenService.startRecording(serial);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/screen/record/stop',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      await screenService.stopRecording(serial);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:serial/screen/record/download',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const localPath = await screenService.getRecording(serial);

      res.set('Content-Type', 'video/mp4');
      res.set('Content-Disposition', `attachment; filename="recording_${serial}.mp4"`);

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

router.get(
  '/:serial/screen/record/status',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      res.json({ recording: screenService.isRecording(serial) });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
