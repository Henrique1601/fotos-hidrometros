import { readFileSync } from 'node:fs';
import { expect, Page, test } from '@playwright/test';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function criarCampanhaComFoto(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova medição' }).click();
  await page.getByRole('button', { name: 'Torre A' }).click();
  await expect(page.locator('.apt-btn').first()).toBeVisible();

  await page.locator('.apt-btn').first().click();
  await expect(page.locator('.cam-apt')).toHaveText('256');
  await page.setInputFiles('.camera-overlay input[type=file]', {
    name: 'foto.jpg',
    mimeType: 'image/jpeg',
    buffer: TINY_PNG,
  });
  await page.getByRole('button', { name: 'Salvar e próximo' }).click();
  await expect(page.locator('.cam-apt')).toHaveText('255');
  await page.getByRole('button', { name: 'Fechar câmera' }).click();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nova medição' })).toBeVisible();
}

test('fluxo completo: captura, auto-avanço, índice e resumo no export', async ({ page }) => {
  await criarCampanhaComFoto(page);

  await page.getByRole('button', { name: 'Índices' }).click();
  await expect(page.locator('#iv-input')).toBeVisible();
  await page.locator('#iv-input').fill('1234,5');
  await page.keyboard.press('Enter');
  await expect(page.locator('.iv-filled')).toBeVisible();

  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar' }).click();
  const rowA = page.locator('.tower-detail-row').filter({ hasText: 'Torre A' });
  await expect(rowA).toBeVisible();
  await expect(rowA).toContainText('1/180 fotos');
  await expect(rowA).toContainText('1 índice');
});

test('backup baixa arquivo com dados e restore restaura', async ({ page }) => {
  await criarCampanhaComFoto(page);

  await page.getByRole('button', { name: 'Dados' }).click();
  await expect(page.getByRole('heading', { name: 'Dados', exact: true })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Baixar/ }).click(),
  ]);
  const file = await download.path();
  expect(file).toBeTruthy();
  const data = JSON.parse(readFileSync(file!, 'utf8'));
  expect(data.records.length).toBeGreaterThanOrEqual(1);

  await page.setInputFiles('.page-card input[type=file]', file!);
  await expect(page.locator('.restore-summary-box')).toBeVisible();
  await page.locator('.modal-panel').getByRole('button', { name: /Apenas Índices/ }).click();
  await page.locator('.modal-panel').getByRole('button', { name: /Substituir|Restaurar/ }).click();
  await expect(page.getByText(/Backup restaurado/)).toBeVisible();
});

test('índice inválido mostra aviso e não bloqueia', async ({ page }) => {
  await criarCampanhaComFoto(page);

  await page.getByRole('button', { name: 'Índices' }).click();
  await expect(page.locator('#iv-input')).toBeVisible();
  await page.locator('#iv-input').fill('abc');
  await page.keyboard.press('Enter');
  await expect(page.locator('.iv-warn')).toBeVisible();
  await page.locator('#iv-input').fill('1234,5');
  await page.keyboard.press('Enter');
  await expect(page.locator('.iv-filled')).toBeVisible();
});

test('bloqueio de medição concluída protege fotos e índices', async ({ page }) => {
  await criarCampanhaComFoto(page);

  await page.getByRole('button', { name: 'Concluir medição' }).click();
  await expect(page.getByText('Concluir medição?')).toBeVisible();
  await page.locator('.modal-panel').getByRole('button', { name: 'Concluir' }).click();

  await expect(page.locator('.campaign-status-badge.done')).toBeVisible();

  await page.getByRole('button', { name: 'Índices' }).click();
  await expect(page.locator('.campaign-locked-banner')).toBeVisible();
  await expect(page.locator('#iv-input')).toBeDisabled();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();

  await page.getByRole('button', { name: 'Fotos' }).click();
  await expect(page.locator('.campaign-locked-banner')).toBeVisible();

  await page.locator('.campaign-locked-banner').getByRole('button', { name: 'Reabrir' }).click();
  await expect(page.getByText('Reabrir medição?')).toBeVisible();
  await page.locator('.modal-panel').getByRole('button', { name: 'Reabrir' }).click();

  await expect(page.locator('.campaign-locked-banner')).not.toBeVisible();
});

test('remover foto pelo botão X atualiza o card e limpa o registro', async ({ page }) => {
  await criarCampanhaComFoto(page);

  await page.getByRole('button', { name: 'Fotos' }).click();
  const apt256 = page.locator('.apt-btn', { hasText: '256' });
  await expect(apt256).toHaveClass(/apt-photo/);

  const btnX = apt256.locator('.apt-delete');
  await expect(btnX).toBeVisible();
  await btnX.click();

  await expect(page.getByText('Remover foto?')).toBeVisible();
  await page.locator('.modal-panel').getByRole('button', { name: 'Remover' }).click();

  await expect(page.getByText('Foto do ap 256 removida.')).toBeVisible();
  await expect(apt256).toHaveClass(/apt-empty/);
  await expect(btnX).not.toBeVisible();
});

