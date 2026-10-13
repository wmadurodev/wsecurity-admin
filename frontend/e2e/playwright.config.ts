import { defineConfig, devices } from '@playwright/test'

import { env } from './support/env'

/**
 * Testes de ponta a ponta do console (RNF-QUA-03) contra o ambiente real do wsecurity-infra. Rodam em contêiner pela
 * imagem do Playwright (make e2e-admin). Cada jornada cria os próprios dados, com nomes únicos por execução.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  workers: 3,
  // A jornada 5 espera a sessão ociosa expirar.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  outputDir: 'results',
  use: {
    baseURL: env.baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
})
