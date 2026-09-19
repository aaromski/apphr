import { test, expect, Page } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_EMAIL || '';
const E2E_PASSWORD = process.env.E2E_PASSWORD || '';
const E2E_HOTEL_CODE = process.env.E2E_HOTEL_CODE || '';
const E2E_ROLE = process.env.E2E_ROLE || 'admin';

const credentialsReady = Boolean(E2E_EMAIL && E2E_PASSWORD && E2E_HOTEL_CODE);

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[name="hotelCode"]').fill(E2E_HOTEL_CODE);
  await page.locator('input[name="email"]').fill(E2E_EMAIL);
  await page.locator('input[name="password"]').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
}

test.describe('AppHR - Landing y Autenticación', () => {
  test('muestra la página de bienvenida con enlaces a login y registro', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Iniciar Sesión' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Registrar Hotel' }).first()).toBeVisible();
  });

  test('muestra el formulario de login en /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="hotelCode"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).toBeVisible();
  });

  test('muestra el formulario de registro en /registro', async ({ page }) => {
    await page.goto('/registro');
    await expect(page.locator('input[name="hotelName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar Hotel' })).toBeVisible();
  });

  test('rechaza credenciales inválidas en /login', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="hotelCode"]').fill('CODIGO-INVALIDO');
    await page.locator('input[name="email"]').fill('nadie@apphr.test');
    await page.locator('input[name="password"]').fill('contraseña-mala');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await expect(page.locator('.text-red-500, .text-red-400')).toBeVisible();
  });
});

test.describe('AppHR - Panel por rol', () => {
  test.skip(!credentialsReady, 'Define E2E_HOTEL_CODE, E2E_EMAIL y E2E_PASSWORD para ejecutar este flujo');

  test('admin accede al dashboard gerencial', async ({ page }) => {
    test.skip(E2E_ROLE !== 'admin', 'El usuario de prueba no es administrador');
    await login(page);
    await page.waitForURL(/\/admin/, { timeout: 20_000 });
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('personal de limpieza accede a su panel', async ({ page }) => {
    test.skip(E2E_ROLE !== 'limpieza', 'El usuario de prueba no es de limpieza');
    await login(page);
    await page.waitForURL(/\/limpieza/, { timeout: 20_000 });
    await expect(page.getByText(/Pendientes|Por Limpiar|En Proceso/).first()).toBeVisible();
  });

  test('recepción accede al tablero de habitaciones', async ({ page }) => {
    test.skip(E2E_ROLE !== 'recepcionista', 'El usuario de prueba no es de recepción');
    await login(page);
    await page.waitForURL(/\/recepcionista/, { timeout: 20_000 });
    await expect(page.getByText(/Disponibles|Ocupadas|Sucias/).first()).toBeVisible();
  });
});