import { Router, Request, Response, NextFunction } from 'express';
import { intentService } from '../services/intent.service';
import { deviceGuard } from '../middleware/device-guard';
import { validate } from '../middleware/validate';
import { intentBody } from '../validators/intent.validator';

const router = Router();

router.post(
  '/:serial/intent',
  deviceGuard,
  validate(intentBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serial = req.params.serial as string;
      const result = await intentService.sendIntent(serial, req.body);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
