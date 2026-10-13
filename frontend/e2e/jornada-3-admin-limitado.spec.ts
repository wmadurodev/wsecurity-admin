import { expect, test } from '@playwright/test'

import { addMember, createTenant, createTenantRole, createUser } from './support/data'
import { signIn } from './support/login'
import { fetchFromPage } from './support/security'

/**
 * Jornada 3 (04 §6.1): administrador com `core.members:read` apenas não vê ações de escrita, e um `PATCH` forjado no
 * console do navegador recebe `403` da API (RN-03: a autoridade é a API).
 */
test('administrador limitado: só leitura e PATCH forjado recusado', async ({ page }) => {
  const owner = await createUser('dono')
  const limited = await createUser('leitor')
  const tenant = await createTenant(owner)
  await createTenantRole(tenant.slug, 'leitor-membros', [{ feature: 'core.members', access: 'READ' }])
  await addMember(tenant.slug, limited, ['leitor-membros'])

  await signIn(page, limited)
  await page.goto(`/t/${tenant.slug}/members`)
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('button', { name: `Copiar ${owner.id}` })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adicionar membro' })).toHaveCount(0)

  await page.goto(`/t/${tenant.slug}/members/${owner.id}`)
  await expect(page.getByRole('heading', { level: 1, name: /Membro/ })).toBeVisible()
  for (const action of ['Suspender', 'Remover do tenant', 'Salvar papéis', 'Definir expiração']) {
    await expect(page.getByRole('button', { name: action })).toHaveCount(0)
  }

  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString()
  const status = await fetchFromPage(page, 'PATCH', `/bff/api/authz/v1/tenants/${tenant.slug}/members/${owner.id}`, {
    body: { expiresAt },
  })
  expect(status).toBe(403)
})
