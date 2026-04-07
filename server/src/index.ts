import { createServer } from 'http';
import { createApp } from './app';
import { createSocketServer } from './socket';
import { config } from './config';
import { logger } from './utils/logger';

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(config.port, () => {
  logger.info(`ADB Master server running on http://localhost:${config.port}`);
});
