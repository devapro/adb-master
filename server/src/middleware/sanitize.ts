import { Request, Response, NextFunction } from 'express';
import { isCommandBlocked } from '../utils/command-whitelist';
import { AppError } from './error-handler';

export function sanitizeCommand(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const command = req.body?.command;

  if (typeof command === 'string' && isCommandBlocked(command)) {
    return next(new AppError(403, 'Command is blocked for safety reasons'));
  }

  next();
}
