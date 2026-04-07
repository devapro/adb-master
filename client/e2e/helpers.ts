import { Page } from '@playwright/test';

/**
 * Mock all backend endpoints so tests run without a real server.
 * - API calls return empty/default responses.
 * - Socket.IO polling is aborted (the app renders fine without it).
 */
export async function mockBackend(page: Page) {
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('/api/devices', (route) => route.fulfill({ json: [] }));
  await page.route('/api/**', (route) => route.fulfill({ json: {} }));
}
