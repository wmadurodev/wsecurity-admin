import { expect, test } from '@playwright/test'

import { expectAccessible } from './support/a11y'
import { createUser, uniqueId } from './support/data'
import { signIn } from './support/login'

/**
 * Jornada 1 (04 §6.1): administrador da plataforma entra sem recuo de escopo, cria um usuário por convite, cria um
 * tenant com esse usuário como dono e o módulo `demo`, cria um papel global e sai.
 */
test('administrador da plataforma: usuário, tenant, papel global e logout', async ({ page }, testInfo) => {
  const admin = await createUser('plataforma', { platformAdmin: true })
  const id = uniqueId()
  const invited = `e2e.convidado.${id}@exemplo.local`

  const login = await signIn(page, admin)
  expect(login.scopeFallback).toBe(false)
  await expect(page).toHaveURL(/\/platform$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Plataforma' })).toBeVisible()

  // Usuário por convite
  await page.goto('/platform/users')
  await expect(page.getByRole('heading', { level: 1, name: 'Usuários' })).toBeVisible()
  await expectAccessible(page, testInfo, 'lista de usuários')
  await page.getByRole('button', { name: 'Novo usuário' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill(invited)
  await dialog.getByRole('textbox', { name: 'Nome' }).fill(`E2E Convidado ${id}`)
  await expect(dialog.getByRole('radio', { name: 'Convite por e-mail' })).toBeChecked()
  await expectAccessible(page, testInfo, 'novo usuário')
  await dialog.getByRole('button', { name: 'Criar usuário' }).click()
  await expect(page.getByText('Usuário criado. O convite foi enviado por e-mail.')).toBeVisible()
  await expect(page).toHaveURL(/\/platform\/users\/[\w-]+$/)
  await expect(page.getByText(invited).first()).toBeVisible()
  await expectAccessible(page, testInfo, 'detalhe do usuário')

  // Tenant com o convidado como dono e o módulo demo
  const slug = `e2e-${id}`
  await page.goto('/platform/tenants/new')
  await page.getByRole('textbox', { name: 'Nome' }).fill(`E2E Tenant ${id}`)
  await page.getByRole('textbox', { name: 'Slug' }).fill(slug)
  await page.getByRole('textbox', { name: 'Plano' }).fill('e2e')
  await page.getByRole('checkbox', { name: /\bdemo\b/ }).check()
  await page.getByRole('combobox', { name: 'Dono' }).fill(invited)
  await page.getByRole('option', { name: new RegExp(invited.replace(/\./g, '\\.')) }).click()
  await expectAccessible(page, testInfo, 'novo tenant')
  await page.getByRole('button', { name: 'Criar tenant' }).click()
  await expect(page.getByText(`Tenant ${slug} criado.`)).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/platform/tenants/${slug}$`))

  // Papel global pela matriz
  const code = `e2e-${id}`
  await page.goto('/platform/roles/new')
  await page.getByRole('textbox', { name: 'Código' }).fill(code)
  await page.getByRole('textbox', { name: 'Nome' }).fill(`E2E Papel ${id}`)
  // Outros módulos do catálogo podem ter funcionalidades com o mesmo nome: a seção do módulo demo delimita.
  await page
    .getByRole('region', { name: /Demonstração/ })
    .getByRole('radiogroup', { name: 'Acesso a Pedidos', exact: true })
    .getByText('Leitura', { exact: true })
    .click()
  await expectAccessible(page, testInfo, 'matriz do papel global')
  await page.getByRole('button', { name: 'Criar papel' }).click()
  await expect(page.getByText('Papel criado.')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/platform/roles/${code}$`))

  // Logout: volta ao console, que sem sessão leva ao login do IdP
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.locator('#username')).toBeVisible()
  const session = await page.request.get('/bff/session')
  expect(session.status()).toBe(401)
})
