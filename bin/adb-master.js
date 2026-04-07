#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');

// Check if ADB is available
try {
  execSync('adb version', { stdio: 'ignore' });
} catch {
  console.error('Error: adb not found in PATH.');
  console.error('Install Android platform-tools: https://developer.android.com/tools/releases/platform-tools');
  process.exit(1);
}

// Check if built
const serverDist = path.join(serverDir, 'dist', 'index.js');
const clientDist = path.join(root, 'client', 'dist', 'index.html');

if (!fs.existsSync(serverDist) || !fs.existsSync(clientDist)) {
  console.log('Building ADB Master...');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

// Start server (serves both API and client static files)
const port = process.env.PORT || 3000;
console.log(`Starting ADB Master on http://localhost:${port}`);

const server = spawn('node', [serverDist], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  },
});

server.on('close', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});
