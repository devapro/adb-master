import { createServer } from 'http';
import { createApp } from './app';
import { createSocketServer } from './socket';
import { config } from './config';
import { logger } from './utils/logger';
import { RelayClient } from './relay/relay-client';

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer);

let relayClient: RelayClient | null = null;

httpServer.listen(config.port, () => {
  logger.info(`ADB Master server running on http://localhost:${config.port}`);

  if (config.relayUrl) {
    logger.info('Relay URL configured, starting relay client...');
    relayClient = new RelayClient(
      config.relayUrl,
      config.port,
      config.relayPassword || undefined,
    );
    relayClient.start().catch((err) => {
      logger.error(`Failed to start relay client: ${err}`);
    });
  }
});

function shutdown(): void {
  logger.info('Shutting down...');
  if (relayClient) {
    relayClient.stop();
  }
  httpServer.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
