import { Router, Request, Response, NextFunction } from 'express';
import { ChildProcess } from 'child_process';
import multer from 'multer';
import { shellService } from '../services/shell.service';
import { adbService } from '../services/adb.service';
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

// --- Managed shell sessions for HTTP polling (relay mode) ---

interface ManagedShellSession {
  process: ChildProcess;
  outputBuffer: string;
  alive: boolean;
}

const managedSessions = new Map<string, ManagedShellSession>();

function closeSession(serial: string) {
  const session = managedSessions.get(serial);
  if (session) {
    session.process.kill();
    managedSessions.delete(serial);
  }
}

router.post(
  '/:serial/shell/session',
  deviceGuard,
  (_req: Request, res: Response) => {
    const serial = _req.params.serial as string;

    // Close existing session for this device
    closeSession(serial);

    const proc = adbService.spawnProcess(serial, ['shell']);
    const session: ManagedShellSession = {
      process: proc,
      outputBuffer: '',
      alive: true,
    };

    proc.stdout?.on('data', (chunk: Buffer) => {
      session.outputBuffer += chunk.toString();
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      session.outputBuffer += chunk.toString();
    });

    proc.on('close', () => {
      session.alive = false;
    });

    managedSessions.set(serial, session);
    res.json({ data: { success: true } });
  }
);

router.get(
  '/:serial/shell/session',
  deviceGuard,
  (_req: Request, res: Response) => {
    const serial = _req.params.serial as string;
    const session = managedSessions.get(serial);

    if (!session) {
      res.json({ data: { active: false, output: '' } });
      return;
    }

    const output = session.outputBuffer;
    session.outputBuffer = '';

    res.json({ data: { active: session.alive, output } });
  }
);

router.post(
  '/:serial/shell/session/input',
  deviceGuard,
  (req: Request, res: Response) => {
    const serial = req.params.serial as string;
    const session = managedSessions.get(serial);

    if (!session || !session.alive) {
      res.status(404).json({ error: 'No active shell session', code: 404 });
      return;
    }

    const { data } = req.body;
    if (data && session.process.stdin) {
      session.process.stdin.write(data);
    }

    res.json({ data: { success: true } });
  }
);

router.delete(
  '/:serial/shell/session',
  deviceGuard,
  (_req: Request, res: Response) => {
    const serial = _req.params.serial as string;
    closeSession(serial);
    res.json({ data: { success: true } });
  }
);

// --- Existing endpoints ---

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
