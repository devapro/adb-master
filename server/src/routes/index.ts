import { Router } from 'express';
import devicesRouter from './devices.router';
import appsRouter from './apps.router';
import filesRouter from './files.router';
import networkRouter from './network.router';
import logcatRouter from './logcat.router';
import shellRouter from './shell.router';
import deviceInfoRouter from './device-info.router';
import screenRouter from './screen.router';
import intentRouter from './intent.router';
import portRouter from './port.router';
import inputRouter from './input.router';
import settingsRouter from './settings.router';

const router = Router();

router.use('/devices', devicesRouter);
router.use('/devices', appsRouter);
router.use('/devices', filesRouter);
router.use('/devices', networkRouter);
router.use('/devices', logcatRouter);
router.use('/devices', shellRouter);
router.use('/devices', deviceInfoRouter);
router.use('/devices', screenRouter);
router.use('/devices', intentRouter);
router.use('/devices', portRouter);
router.use('/devices', inputRouter);
router.use('/devices', settingsRouter);

export default router;
