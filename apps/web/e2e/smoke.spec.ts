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

  test('consulta flow: status → select INC-20311 → overdue actions', async ({ page }) => {
    // Prior demos may leave Ana in waiting_analyst; close open threads so chat can talk to the agent.
    const { execFileSync } = await import('node:child_process');
    execFileSync(
      'psql',
      [
        'postgres://nexo:nexo@localhost:5432/nexo',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        "UPDATE conversations SET status = 'closed', busy_until = NULL WHERE employee_id = 'a1111111-1111-4111-8111-111111111111' AND status <> 'closed';",
      ],
      { stdio: 'pipe' },
    );

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail corporativo' }).fill('ana.souza@nexo.com.br');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Entrar →' }).click();
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByText('Assistente online')).toBeVisible();

    await page.getByLabel('Mensagem').fill('Qual o status do meu chamado?');
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.getByText('consultou seus chamados')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Você tem \d+ chamados? abertos?/i)).toBeVisible();
    await expect(page.getByText(/Sobre qual/i)).toBeVisible();
    await expect(page.getByRole('radio', { name: /INC-20311/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /INC-20298/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /REQ-10442/i })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(3);

    await page.getByRole('radio', { name: /INC-20311/i }).click();

    await expect(page.getByText(/consultou o INC-20311/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('calculou o prazo')).toBeVisible();
    await expect(page.getByText(/prazo vencido/i)).toBeVisible();
    await expect(page.getByText(/Quer que eu chame um analista/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Falar com um analista' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar informação' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Não, obrigado' })).toBeVisible();
  });
});
