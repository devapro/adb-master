import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.goto('/devices');
});

test('shows page title', async ({ page }) => {
  await expect(page.locator('.page-title')).toHaveText('Connected Devices');
});

test('shows empty state message when no devices', async ({ page }) => {
  await expect(page.getByText('No devices connected')).toBeVisible();
});

test('shows connection instructions when no devices', async ({ page }) => {
  await expect(page.getByText('How to Connect a Device')).toBeVisible();
});

test('shows Connect WiFi button', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Connect WiFi' })).toBeVisible();
});

test('Connect WiFi button opens the wireless connection modal', async ({ page }) => {
  await page.getByRole('button', { name: 'Connect WiFi' }).click();
  await expect(page.getByText('IP Address')).toBeVisible();
  await expect(page.getByText('Port')).toBeVisible();
});

test('wireless modal has default port 5555', async ({ page }) => {
  await page.getByRole('button', { name: 'Connect WiFi' }).click();
  await expect(page.locator('input[type="number"]')).toHaveValue('5555');
});

test('wireless modal can be closed with Cancel', async ({ page }) => {
  await page.getByRole('button', { name: 'Connect WiFi' }).click();
  await expect(page.locator('input[placeholder="192.168.1.100"]')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('input[placeholder="192.168.1.100"]')).not.toBeVisible();
});

test('wireless modal host field accepts input', async ({ page }) => {
  await page.getByRole('button', { name: 'Connect WiFi' }).click();
  const hostInput = page.locator('input[placeholder="192.168.1.100"]');
  await hostInput.fill('192.168.1.42');
  await expect(hostInput).toHaveValue('192.168.1.42');
});

test('shows API error in modal when connection fails', async ({ page }) => {
  await page.route('/api/devices/connect', (route) =>
    route.fulfill({ status: 500, json: { message: 'Connection refused' } })
  );
  await page.getByRole('button', { name: 'Connect WiFi' }).click();
  await page.locator('input[placeholder="192.168.1.100"]').fill('10.0.0.1');
  await page.getByRole('button', { name: 'Connect WiFi' }).last().click();
  // Error message should appear in the modal
  await expect(page.locator('.wireless-error')).toBeVisible();
});
