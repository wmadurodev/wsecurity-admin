import { expect, test } from '@playwright/test'

import { createTenant, createUser } from './support/data'
import { env } from './support/env'
import { signIn } from './support/login'

/**
 * Jornada 5 (04 §6.1): com o console configurado para expirar rápido (make e2e-admin), a sessão ociosa expira, a SPA
 * mostra o aviso e, depois de entrar de novo, volta para a mesma tela.
 */
test('sessão expirada: aviso e volta para a mesma tela', async ({ page }) => {
  test.skip(!env.sessionIdleSeconds, 'Console sem ociosidade curta (E2E_SESSION_IDLE_SECONDS).')
  const owner = await createUser('sessao')
  const tenant = await createTenant(owner)
  // O Spring Security devolve a requisição salva com o parâmetro `continue`.
  const rolesScreen = new RegExp(`/t/${tenant.slug}/roles(\\?continue)?$`)

  await signIn(page, owner)
  await page.goto(`/t/${tenant.slug}/members`)
  await expect(page.getByRole('table')).toBeVisible()

  // Ociosidade além do limite, sem nenhuma chamada ao BFF
  await page.waitForTimeout(((env.sessionIdleSeconds ?? 0) + 5) * 1000)
  await page.getByRole('link', { name: 'Papéis' }).first().click()
  await expect(page.getByText('Sua sessão expirou')).toBeVisible()
  await expect(page).toHaveURL(rolesScreen)

  // A sessão do IdP continua válida: entrar de novo não pede a senha e volta para a mesma tela
  await page.getByRole('button', { name: 'Entrar de novo' }).click()
  await expect(page).toHaveURL(rolesScreen)
  await expect(page.getByRole('heading', { level: 1, name: 'Papéis' })).toBeVisible()
  await expect(page.getByText('Sua sessão expirou')).toHaveCount(0)
  await expect(page.locator('#username')).toHaveCount(0)
})
