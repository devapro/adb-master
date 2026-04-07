import { Router } from 'express';
import devicesRouter from './devices.router';
import appsRouter from './apps.router';
import filesRouter from './files.router';
import networkRouter from './network.router';
import logcatRouter from './logcat.router';
import shellRouter from './shell.router';

const router = Router();

router.use('/devices', devicesRouter);
router.use('/devices', appsRouter);
router.use('/devices', filesRouter);
router.use('/devices', networkRouter);
router.use('/devices', logcatRouter);
router.use('/devices', shellRouter);

export default router;
