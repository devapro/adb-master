import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.goto('/devices');
});

test('device selector shows "No device" when no devices connected', async ({ page }) => {
  await expect(page.locator('.device-select')).toContainText('No device');
});

test('connection indicator shows Local mode by default', async ({ page }) => {
  await expect(page.locator('.connection-indicator')).toContainText('Local');
});

test('clicking connection indicator opens the connection modal', async ({ page }) => {
  await page.locator('.connection-indicator').click();
  await expect(page.getByText('Connection')).toBeVisible();
  // Modal has Local/Remote tab options
  await expect(page.getByText('Local')).toBeVisible();
  await expect(page.getByText('Remote')).toBeVisible();
});

test('theme toggle button is visible', async ({ page }) => {
  await expect(page.locator('.theme-toggle')).toBeVisible();
});

test('theme toggle switches between dark and light', async ({ page }) => {
  const html = page.locator('html');
  const initialTheme = await html.getAttribute('data-theme');

  await page.locator('.theme-toggle').click();

  const newTheme = await html.getAttribute('data-theme');
  expect(newTheme).not.toBe(initialTheme);
});

test('language selector is visible with EN option', async ({ page }) => {
  const langSelect = page.locator('.lang-select');
  await expect(langSelect).toBeVisible();
  await expect(langSelect).toHaveValue('en');
});

test('switching language to Russian updates UI text', async ({ page }) => {
  await page.locator('.lang-select').selectOption('ru');
  // Sidebar "Devices" translates to "Устройства" in Russian
  await expect(page.locator('.sidebar-nav').getByText('Устройства')).toBeVisible();
});
