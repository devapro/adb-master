import { Request, Response, NextFunction } from 'express';
import { deviceService } from '../services/device.service';
import { AppError } from './error-handler';

const SERIAL_REGEX = /^[a-zA-Z0-9.:_-]+$/;

export async function deviceGuard(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const serial = req.params.serial as string;

  if (!serial || !SERIAL_REGEX.test(serial)) {
    return next(new AppError(400, 'Invalid device serial format'));
  }

  const devices = await deviceService.getDevices();
  const device = devices.find((d) => d.serial === serial);

  if (!device) {
    return next(new AppError(404, `Device ${serial} not found`));
  }

  if (device.state !== 'device') {
    return next(new AppError(409, `Device ${serial} is ${device.state}`));
  }

  next();
}
