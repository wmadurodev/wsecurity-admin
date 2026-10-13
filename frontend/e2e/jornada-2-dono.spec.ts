import { expect, test } from '@playwright/test'

import { expectAccessible } from './support/a11y'
import { createTenant, createUser, uniqueId } from './support/data'
import { signIn } from './support/login'

/**
 * Jornada 2 (04 §6.1): dono de tenant entra como usuário comum (recuo de escopo sem pedir a senha de novo), cai no
 * tenant, adiciona um membro com `viewer`, cria um papel do tenant pela matriz, troca os papéis do membro e vê a
 * auditoria.
 */
test('dono de tenant: membro, papel do tenant e auditoria', async ({ page }, testInfo) => {
  const owner = await createUser('dono')
  const member = await createUser('membro')
  const tenant = await createTenant(owner)
  const code = `atendente-${uniqueId()}`

  const login = await signIn(page, owner)
  expect(login.scopeFallback).toBe(true)
  expect(login.loginForms).toBe(1)
  await expect(page).toHaveURL(new RegExp(`/t/${tenant.slug}$`))
  await expect(page.getByRole('heading', { level: 1, name: tenant.name })).toBeVisible()
  await expectAccessible(page, testInfo, 'visão geral do tenant')

  // Adicionar membro por e-mail com viewer
  await page.goto(`/t/${tenant.slug}/members`)
  await page.getByRole('button', { name: 'Adicionar membro' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'E-mail', exact: true }).fill(member.email)
  await dialog.getByRole('checkbox', { name: 'Enviar convite por e-mail' }).uncheck()
  await dialog.getByRole('checkbox', { name: /viewer/ }).check()
  await expectAccessible(page, testInfo, 'adicionar membro')
  await dialog.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByText(`${member.email} adicionado ao tenant.`)).toBeVisible()
  await expect(page.getByRole('button', { name: `Copiar ${member.id}` })).toBeVisible()
  await expectAccessible(page, testInfo, 'lista de membros')

  // Papel do tenant pela matriz
  await page.goto(`/t/${tenant.slug}/roles/new`)
  await page.getByRole('textbox', { name: 'Código' }).fill(code)
  await page.getByRole('textbox', { name: 'Nome' }).fill('Atendente')
  await page.getByRole('radiogroup', { name: 'Acesso a demo.orders' }).getByText('Escrita').click()
  await page.getByRole('radiogroup', { name: 'Acesso a core.members' }).getByText('Leitura').click()
  await expectAccessible(page, testInfo, 'matriz do papel do tenant')
  await page.getByRole('button', { name: 'Criar papel' }).click()
  await expect(page.getByText('Papel criado.')).toBeVisible()

  // Trocar os papéis do membro
  await page.goto(`/t/${tenant.slug}/members/${member.id}`)
  await page.getByRole('checkbox', { name: new RegExp(code) }).check()
  await page.getByRole('checkbox', { name: /viewer/ }).uncheck()
  await expectAccessible(page, testInfo, 'detalhe do membro')
  await page.getByRole('button', { name: 'Salvar papéis' }).click()
  await expect(page.getByText('Papéis do membro salvos.')).toBeVisible()

  // Auditoria do tenant
  await page.goto(`/t/${tenant.slug}/audit`)
  const events = page.getByRole('table')
  await expect(events.getByRole('button', { name: 'Papel criado' })).toBeVisible()
  await expect(events.getByRole('button', { name: 'Membro adicionado' }).first()).toBeVisible()
  await expectAccessible(page, testInfo, 'auditoria do tenant')
})
