import { RelayServer } from './relay-server';

const relay = new RelayServer();
relay.start();

const shutdown = async () => {
  console.log('\nShutting down relay server...');
  await relay.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
