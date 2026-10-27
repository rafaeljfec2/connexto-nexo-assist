import { test, expect } from '@playwright/test';

/**
 * Smoke coverage for the five screen flows.
 * Requires `pnpm dev` with LLM_PROVIDER=scripted and seeded database.
 */
test.describe('Nexo Assist smoke', () => {
  test('login screen renders brand and form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Seu problema de TI, resolvido em uma conversa.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('employee can open chat after login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('ana.souza@nexo.com.br');
    await page.getByLabel('Senha').fill('demo');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByText('Service desk de TI / Atendimento')).toBeVisible();
  });

  test('analyst reaches console queue', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('rafael.lima@nexo.com.br');
    await page.getByLabel('Senha').fill('demo');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/console/);
    await expect(page.getByText('Console do analista')).toBeVisible();
  });
});
