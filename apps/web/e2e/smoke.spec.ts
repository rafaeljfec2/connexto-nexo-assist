import { test, expect } from '@playwright/test';

/**
 * Smoke coverage for the six screen flows.
 * Requires `pnpm dev` with LLM_PROVIDER=scripted and seeded database.
 */
test.describe('Nexo Assist smoke', () => {
  test('login screen renders brand, metrics and form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Seu problema de TI, resolvido em uma conversa.')).toBeVisible();
    await expect(page.getByText('8 s')).toBeVisible();
    await expect(page.getByText('72%')).toBeVisible();
    await expect(page.getByText('Ligue no ramal 4000')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar →' })).toBeVisible();
  });

  test('employee can open chat after login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail corporativo' }).fill('ana.souza@nexo.com.br');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Entrar →' }).click();
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByText('Service desk de TI')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Atendimento' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Meu perfil' })).toBeVisible();
  });

  test('employee profile is read-only from api.me', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail corporativo' }).fill('ana.souza@nexo.com.br');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Entrar →' }).click();
    await expect(page).toHaveURL(/\/chat/);
    await page.getByRole('link', { name: 'Meu perfil' }).click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
    await expect(page.getByText('Ana Souza').first()).toBeVisible();
    await expect(page.getByText('ana.souza@nexo.com.br').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Redefinir senha' })).toBeDisabled();
  });

  test('analyst reaches console queue with empty state', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail corporativo' }).fill('rafael.lima@nexo.com.br');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Entrar →' }).click();
    await expect(page).toHaveURL(/\/console/);
    await expect(page.getByRole('heading', { name: 'Conversas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Selecione uma conversa' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Para você' })).toBeVisible();
  });
});
