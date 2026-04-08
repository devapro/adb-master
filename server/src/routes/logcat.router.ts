import { Router, Request, Response, NextFunction } from 'express';
import { ChildProcess } from 'child_process';
import { logcatService } from '../services/logcat.service';
import { LogcatLine } from '../types';
import { deviceGuard } from '../middleware/device-guard';

const router = Router();

// --- Managed logcat streams for HTTP polling (relay mode) ---

interface ManagedLogcatStream {
  process: ChildProcess;
  buffer: LogcatLine[];
  cursor: number; // monotonically increasing line ID
}

const managedStreams = new Map<string, ManagedLogcatStream>();
const MAX_BUFFER = 5000;

function stopManagedStream(serial: string) {
  const stream = managedStreams.get(serial);
  if (stream) {
    stream.process.kill();
    managedStreams.delete(serial);
  }
}

router.post(
  '/:serial/logcat/stream',
  deviceGuard,
  (req: Request, res: Response) => {
    const serial = req.params.serial as string;
    const filters = req.body.filters || {};

    // Stop existing stream for this device
    stopManagedStream(serial);

    const stream: ManagedLogcatStream = {
      process: null!,
      buffer: [],
      cursor: 0,
    };

    stream.process = logcatService.startStream(
      serial,
      filters,
      (line) => {
        (line as LogcatLine & { id: number }).id = stream.cursor++;
        stream.buffer.push(line);
        if (stream.buffer.length > MAX_BUFFER) {
          stream.buffer = stream.buffer.slice(-Math.floor(MAX_BUFFER / 2));
        }
      },
      () => { /* errors are picked up via poll */ }
    );

    stream.process.on('close', () => {
      managedStreams.delete(serial);
    });

    managedStreams.set(serial, stream);
    res.json({ data: { success: true } });
  }
);

router.get(
  '/:serial/logcat/stream',
  deviceGuard,
  (req: Request, res: Response) => {
    const serial = req.params.serial as string;
    const since = Number(req.query.since) || 0;
    const stream = managedStreams.get(serial);

    if (!stream) {
      res.json({ data: { active: false, lines: [], cursor: 0 } });
      return;
    }

    const newLines = stream.buffer.filter(
      (l) => (l as LogcatLine & { id: number }).id >= since
    );

    res.json({
      data: {
        active: true,
        lines: newLines,
        cursor: stream.cursor,
      },
    });
  }
);

router.delete(
  '/:serial/logcat/stream',
  deviceGuard,
  (_req: Request, res: Response) => {
    const serial = _req.params.serial as string;
    stopManagedStream(serial);
    res.json({ data: { success: true } });
  }
);

// --- Existing endpoints ---

router.get(
  '/:serial/logcat/snapshot',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const lines = Number(req.query.lines) || 500;
      const snapshot = await logcatService.getSnapshot(serial, lines);
      res.json({ data: snapshot });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:serial/logcat/clear',
  deviceGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      await logcatService.clearLogcat(serial);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
