import { expect, type Page, test } from '@playwright/test'

import { expectAccessible } from './support/a11y'
import { addMember, createTenant, createTenantRole, createUser, deleteUser, userAction } from './support/data'
import { env } from './support/env'
import { signIn } from './support/login'
import { fetchFromPage } from './support/security'

/**
 * Jornada 9 (0010/RF-STA-12): a plataforma desativa um membro e o dono vê "Desativado pela plataforma" sem ações,
 * enquanto o membro perde o acesso ao tenant; depois exclui (nome e e-mail continuam), restaura pelo console (volta
 * ao status anterior) e reativa (o dono volta a ter as ações).
 */
test('desativar, excluir, restaurar e reativar refletem nos membros do tenant', async ({ browser }, testInfo) => {
  const owner = await createUser('dono')
  const member = await createUser('membro')
  const platform = await createUser('plataforma', { platformAdmin: true })
  const tenant = await createTenant(owner)
  await createTenantRole(tenant.slug, 'leitor-membros', [{ feature: 'core.members', access: 'READ' }])
  await addMember(tenant.slug, member, ['leitor-membros'])
  const membersApi = `/bff/api/authz/v1/tenants/${tenant.slug}/members`
  const detail = `/t/${tenant.slug}/members/${member.id}`

  const memberPage = await newPage(browser)
  await signIn(memberPage, member, `/t/${tenant.slug}/members`)
  await expect(memberPage.getByRole('table')).toBeVisible()
  expect(await fetchFromPage(memberPage, 'GET', membersApi)).toBe(200)

  // Desativar: o aviso do IdP chega à autorização na hora.
  await userAction(member.id, 'disable')
  const ownerPage = await newPage(browser)
  await signIn(ownerPage, owner, detail)
  await expectSituation(ownerPage, detail, 'Desativado pela plataforma')
  await expect(ownerPage.getByText(/foi desativada pelo administrador da plataforma/)).toBeVisible()
  for (const action of ['Suspender', 'Remover do tenant', 'Salvar papéis', 'Definir expiração']) {
    await expect(ownerPage.getByRole('button', { name: action })).toHaveCount(0)
  }
  await expectAccessible(ownerPage, testInfo, 'detalhe do membro desativado')
  await ownerPage.goto(`/t/${tenant.slug}/members`)
  await expect(ownerPage.getByRole('table').getByText('Desativado pela plataforma')).toBeVisible()
  await expectAccessible(ownerPage, testInfo, 'membros com conta desativada')

  // O membro perde o acesso ao tenant como num vínculo suspenso.
  await expect.poll(() => fetchFromPage(memberPage, 'GET', membersApi)).not.toBe(200)

  // Excluir: nome e e-mail continuam visíveis para o dono.
  await deleteUser(member.id)
  await expectSituation(ownerPage, `/t/${tenant.slug}/members`, 'Excluído pela plataforma')
  await expect(ownerPage.getByRole('table').getByText(member.email, { exact: true })).toBeVisible()

  // Restaurar pelo console: volta ao status anterior (desativado).
  const platformPage = await newPage(browser)
  await signIn(platformPage, platform, `/platform/users/${member.id}`)
  await expect(platformPage.getByText(/pela plataforma/)).toBeVisible()
  await platformPage.getByRole('button', { name: 'Restaurar' }).click()
  await platformPage.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click()
  await expect(platformPage.getByRole('button', { name: 'Reativar' })).toBeVisible()
  await expectAccessible(platformPage, testInfo, 'usuário restaurado')
  await expectSituation(ownerPage, detail, 'Desativado pela plataforma')

  // Reativar: o dono volta a ter as ações.
  await userAction(member.id, 'enable')
  await expect
    .poll(async () => {
      await ownerPage.goto(detail)
      await ownerPage.waitForLoadState('networkidle')
      return ownerPage.getByRole('button', { name: 'Suspender' }).count()
    })
    .toBe(1)
  await expect(ownerPage.getByText('Desativado pela plataforma')).toHaveCount(0)
})

async function newPage(browser: import('@playwright/test').Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: env.baseURL })
  return context.newPage()
}

/** Recarrega até o selo aparecer: o aviso do IdP é assíncrono (milissegundos, normalmente). */
async function expectSituation(page: Page, path: string, label: string): Promise<void> {
  await expect
    .poll(async () => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      return page.getByText(label, { exact: true }).count()
    })
    .toBeGreaterThan(0)
}
