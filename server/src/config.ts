import path from 'path';
import os from 'os';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  adbPath: process.env.ADB_PATH || 'adb',
  commandTimeout: parseInt(process.env.COMMAND_TIMEOUT || '30000', 10),
  maxScriptSize: 64 * 1024, // 64KB
  scriptTimeout: 5 * 60 * 1000, // 5 minutes
  devicePollInterval: 3000, // 3 seconds
  logcatBufferSize: 5000, // lines to keep in memory
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  maxApkSize: 500 * 1024 * 1024, // 500MB
  maxUploadSize: 500 * 1024 * 1024, // 500MB
  uploadTimeout: 10 * 60 * 1000, // 10 minutes
  uploadDir: path.join(os.tmpdir(), 'adb-master-uploads'),
  relayUrl: process.env.RELAY_URL || '',
  relayPassword: process.env.RELAY_PASSWORD || '',
};
