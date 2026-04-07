import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { shellService } from '../services/shell.service';
import { deviceGuard } from '../middleware/device-guard';
import { validate } from '../middleware/validate';
import { sanitizeCommand } from '../middleware/sanitize';
import { shellCommandBody } from '../validators/shell.validator';
import { config } from '../config';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxScriptSize },
});

router.post(
  '/:serial/shell',
  deviceGuard,
  validate(shellCommandBody),
  sanitizeCommand,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const result = await shellService.executeCommand(serial, req.body.command);
      res.json({
        data: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/shell/script',
  deviceGuard,
  upload.single('script'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No script file provided', code: 400 });
        return;
      }

      const serial = req.params.serial as string;
      const content = req.file.buffer.toString('utf-8');
      const results = await shellService.executeScript(serial, content);
      res.json({ data: { results } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
