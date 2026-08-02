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
  await expect(page.locator('.cam-apt')).toHaveText('34');
  await page.setInputFiles('.camera-overlay input[type=file]', {
    name: 'foto.jpg',
    mimeType: 'image/jpeg',
    buffer: TINY_PNG,
  });
  await page.getByRole('button', { name: 'Salvar e próximo' }).click();
  await expect(page.locator('.cam-apt')).toHaveText('33');
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

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Fazer backup' }).click(),
  ]);
  const file = await download.path();
  expect(file).toBeTruthy();
  const data = JSON.parse(readFileSync(file!, 'utf8'));
  expect(data.records.length).toBeGreaterThanOrEqual(1);

  page.on('dialog', (d) => d.accept());
  await page.setInputFiles('.data-card input[type=file]', file!);
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
