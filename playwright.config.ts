import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config para smoke tests de paridade funcional.
 *
 * Como rodar:
 *   1. Copie .env.local para .env.test (ou exporte as vars):
 *        E2E_BASE_URL=http://localhost:3000
 *        E2E_ADMIN_EMAIL=...
 *        E2E_ADMIN_PASSWORD=...
 *   2. Suba o servidor: npm run dev
 *   3. Em outro terminal: npm run test:e2e
 *
 * Observação (solo dev, sem staging):
 *   Os smoke tests cobrem SÓ paths de leitura + auth. Não dispara geração
 *   real (custaria dinheiro em Segmind/Anthropic). Paridade de geração
 *   é validada por checklist manual antes de merge (ver docs/adr/0002).
 */

const PORT = 3000
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Não subimos webServer automaticamente; o dev server fica sob controle
  // do desenvolvedor (evita recompilar a cada execução de teste local).
})
