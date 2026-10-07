import { expect, test } from '@playwright/test';

test('Cajora informa el alta asistida y conserva acceso al login', async ({ page }) => {
  await page.goto('/cajora/index.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu caja clara.');
  await expect(page.getByRole('link', { name: 'Solicitar acceso al plan gratis' })).toHaveAttribute(
    'href',
    'https://romanromero.dev/#contacto',
  );
  await page.getByRole('link', { name: 'Entrar a mi caja' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByTestId('login-brand')).toContainText('Cajora');
});

test('Cajora permite consultar límites y preguntas desde móvil sin desbordamiento', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/cajora/index.html');
  await page.getByRole('link', { name: 'Plan gratis', exact: true }).click();
  await expect(page).toHaveURL(/#plan$/);
  await expect(page.locator('#plan')).toContainText('Una empresa · Una sucursal · Una caja');
  await page.getByText('¿Funciona sin internet?', { exact: true }).click();
  await expect(
    page.getByText('Esta primera versión requiere conexión a internet para operar.'),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
