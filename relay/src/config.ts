export const config = {
  port: parseInt(process.env.RELAY_PORT || '8080', 10),
  maxSessions: parseInt(process.env.MAX_SESSIONS || '50', 10),
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '86400000', 10), // 24h
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '600000', 10), // 10min (for large files)
  maxRequestSize: 500 * 1024 * 1024, // 500MB
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
