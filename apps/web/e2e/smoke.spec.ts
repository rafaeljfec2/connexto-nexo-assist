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
    await expect(page.getByText('analistas online agora')).toBeVisible();
    await expect(page.getByText('INC-20517')).toBeVisible();
    await expect(page.getByText('Ligue no ramal 4000')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Manter conectado neste computador' })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('employee can open chat after login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail corporativo' }).fill('ana.souza@nexo.com.br');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByText('Service desk de TI')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Atendimento' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Meu perfil' })).toBeVisible();
  });

  test('employee profile is read-only from api.me', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail corporativo' }).fill('ana.souza@nexo.com.br');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/chat/);
    await page.getByRole('link', { name: 'Meu perfil' }).click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
    await expect(page.getByText('Ana Souza').first()).toBeVisible();
    await expect(page.getByText('ana.souza@nexo.com.br').first()).toBeVisible();
    await expect(page.getByText('Gerenciado pela TI')).toBeVisible();
    await expect(page.getByText('Alterada há 42 dias')).toBeVisible();
    await expect(
      page.getByText('Enviaremos um link de redefinição para ana.souza@nexo.com.br.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Redefinir senha' })).toBeDisabled();
  });

  test('analyst reaches console queue with empty state', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail corporativo' }).fill('rafael.lima@nexo.com.br');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/console/);
    await expect(page.getByRole('heading', { name: 'Conversas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Selecione uma conversa' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Para você' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Todas' })).toBeVisible();
  });

  test('analyst claims Ana waiting conversation from Para você', async ({ page }) => {
    const { execFileSync } = await import('node:child_process');
    execFileSync(
      'psql',
      [
        'postgres://nexo:nexo@localhost:5432/nexo',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        "INSERT INTO conversations (id, employee_id, status, analyst_id, employee_message_count, summary) VALUES ('c5555555-5555-4555-8555-555555555555', 'a1111111-1111-4111-8111-111111111111', 'waiting_analyst', NULL, 4, 'Está parado há 5 dias. Quero falar com um analista. · INC-20311') ON CONFLICT (id) DO UPDATE SET status = 'waiting_analyst', analyst_id = NULL, summary = EXCLUDED.summary, busy_until = NULL, active_execution_id = NULL, updated_at = NOW();",
      ],
      { stdio: 'pipe' },
    );

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail corporativo' }).fill('rafael.lima@nexo.com.br');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/console/);

    await page.getByRole('button', { name: 'Para você' }).click();
    await expect(page.getByRole('button', { name: /Ana Souza/i })).toBeVisible();
    await expect(page.getByText(/Transferida · INC-20311/i).first()).toBeVisible();

    await page.getByRole('button', { name: /Ana Souza/i }).click();
    await expect(page.getByText('Aguardando atendente')).toBeVisible();
    await expect(page.getByText(/Ana espera um atendente/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assumir atendimento' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Devolver ao agent' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Chamados da Ana/i })).toBeVisible();
    await expect(page.getByText('Desta conversa')).toBeVisible();
    await expect(page.getByText('INC-20311').first()).toBeVisible();

    await page.getByRole('button', { name: 'Assumir atendimento' }).click();
    await expect(page.getByText('Você está atendendo')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Mensagem do analista')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Devolver ao agent' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Encerrar' })).toBeVisible();
  });

  test('analyst returns Ana waiting conversation to the agent', async ({ page }) => {
    const { execFileSync } = await import('node:child_process');
    execFileSync(
      'psql',
      [
        'postgres://nexo:nexo@localhost:5432/nexo',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        "INSERT INTO conversations (id, employee_id, status, analyst_id, employee_message_count, summary) VALUES ('c5555555-5555-4555-8555-555555555555', 'a1111111-1111-4111-8111-111111111111', 'waiting_analyst', NULL, 4, 'Está parado há 5 dias. Quero falar com um analista. · INC-20311') ON CONFLICT (id) DO UPDATE SET status = 'waiting_analyst', analyst_id = NULL, summary = EXCLUDED.summary, busy_until = NULL, active_execution_id = NULL, updated_at = NOW();",
      ],
      { stdio: 'pipe' },
    );

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail corporativo' }).fill('rafael.lima@nexo.com.br');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/console/);

    await page.getByRole('button', { name: 'Para você' }).click();
    await page.getByRole('button', { name: /Ana Souza/i }).click();
    await expect(page.getByRole('button', { name: 'Devolver ao agent' })).toBeVisible();
    await page.getByRole('button', { name: 'Devolver ao agent' }).click();

    await expect(page.getByText('Atendimento devolvido ao agente.').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Agent atendendo').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assumir atendimento' })).toHaveCount(0);
  });

  test('analyst can return after claiming', async ({ page }) => {
    const { execFileSync } = await import('node:child_process');
    execFileSync(
      'psql',
      [
        'postgres://nexo:nexo@localhost:5432/nexo',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        "INSERT INTO conversations (id, employee_id, status, analyst_id, employee_message_count, summary) VALUES ('c5555555-5555-4555-8555-555555555555', 'a1111111-1111-4111-8111-111111111111', 'waiting_analyst', NULL, 4, 'Está parado há 5 dias. Quero falar com um analista. · INC-20311') ON CONFLICT (id) DO UPDATE SET status = 'waiting_analyst', analyst_id = NULL, summary = EXCLUDED.summary, busy_until = NULL, active_execution_id = NULL, updated_at = NOW();",
      ],
      { stdio: 'pipe' },
    );

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail corporativo' }).fill('rafael.lima@nexo.com.br');
    await page.locator('#password').fill('demo');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/console/);

    await page.getByRole('button', { name: 'Para você' }).click();
    await page.getByRole('button', { name: /Ana Souza/i }).click();
    await page.getByRole('button', { name: 'Assumir atendimento' }).click();
    await expect(page.getByText('Você está atendendo')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Devolver ao agent' }).click();
    await expect(page.getByText('Atendimento devolvido ao agente.').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Agent atendendo').first()).toBeVisible();
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
    await page.getByRole('button', { name: 'Entrar' }).click();
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
    // Seed has three open tickets; local HITL demos may add more — require at least the fixtures.
    expect(await page.getByRole('radio').count()).toBeGreaterThanOrEqual(3);

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
