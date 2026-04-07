import express from 'express';
import path from 'path';
import cors from 'cors';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/error-handler';

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', routes);

  // Serve client static files in production
  const clientDir = path.resolve(__dirname, '../../client');
  app.use(express.static(clientDir));
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api') || _req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });

  // Error handler
  app.use(errorHandler);

  return app;
}
