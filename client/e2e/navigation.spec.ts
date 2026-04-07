import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test('redirects / to /devices', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/devices');
});

test('sidebar renders the app brand', async ({ page }) => {
  await page.goto('/devices');
  await expect(page.locator('.sidebar-brand')).toContainText('ADB Master');
});

test('sidebar shows all nav items', async ({ page }) => {
  await page.goto('/devices');
  const nav = page.locator('.sidebar-nav');
  for (const label of ['Devices', 'Device Info', 'Applications', 'Storage', 'Network', 'Logcat', 'Terminal', 'Input', 'Settings']) {
    await expect(nav.getByText(label)).toBeVisible();
  }
});

test('device-dependent nav links are disabled when no device is selected', async ({ page }) => {
  await page.goto('/devices');
  const disabled = page.locator('.sidebar-link.disabled');
  // 8 items require a device (all except Devices)
  await expect(disabled).toHaveCount(8);
});

test('Devices nav link is active on /devices', async ({ page }) => {
  await page.goto('/devices');
  const devicesLink = page.locator('.sidebar-link.active');
  await expect(devicesLink).toContainText('Devices');
});

test('clicking a disabled nav link does not navigate away', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('.sidebar-link.disabled').first().click();
  await expect(page).toHaveURL('/devices');
});
