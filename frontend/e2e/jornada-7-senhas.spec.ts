import { expect, type Page, test } from '@playwright/test'

import { expectAccessible } from './support/a11y'
import { createUser, uniqueId } from './support/data'
import { env } from './support/env'
import { signIn } from './support/login'
import { mailLink } from './support/mail'

/**
 * Jornada 7 (fase 0006): campos de senha. Olho no login do IdP, cadastro com confirmação e critérios em tempo real,
 * troca de senha recusada por reuso, redefinição pelo e-mail e senha inicial com olho no console.
 */

const criterion = (page: Page, name: string) => page.locator(`#password-criteria li[data-criterion="${name}"]`)

/** Tipo do campo no momento do envio do formulário (o olho volta a ocultar antes do envio). */
const typeOnSubmit = (page: Page, fieldId: string) =>
  page.evaluate(
    (id) =>
      new Promise<string>((resolve, reject) => {
        const form = document.querySelector('form')
        if (!form) {
          reject(new Error('Formulário não encontrado'))
          return
        }
        form.addEventListener('submit', () => {
          resolve((document.getElementById(id) as HTMLInputElement).type)
        })
      }),
    fieldId,
  )

test('olho no login do IdP', async ({ page }, testInfo) => {
  const user = await createUser('olho')
  await page.goto('/')
  await expect(page.locator('#username')).toBeVisible()
  const toggle = page.locator('button.password-toggle[aria-controls="password"]')
  await expect(toggle).toHaveAccessibleName('Mostrar senha')
  await expectAccessible(page, testInfo, 'login do IdP')

  await page.fill('#username', user.email)
  await page.fill('#password', user.password)
  await toggle.click()
  await expect(page.locator('#password')).toHaveAttribute('type', 'text')
  await expect(toggle).toHaveAccessibleName('Ocultar senha')
  await toggle.click()
  await expect(page.locator('#password')).toHaveAttribute('type', 'password')
  await toggle.click()
  const submitted = typeOnSubmit(page, 'password')
  await page.locator('button[type=submit]').click()
  expect(await submitted).toBe('password')
})

test('cadastro, troca e redefinição de senha com critérios', async ({ page, request }, testInfo) => {
  const id = uniqueId()
  const email = `e2e.cadastro.${id}@exemplo.local`
  const password = 'cometa lento sobre o vale 7310'
  const changed = 'farol distante na neblina 5528'
  const reset = 'pomar antigo depois da chuva 9142'

  // Cadastro: critérios em tempo real.
  await page.goto(`${env.idp}/account/register`)
  await page.fill('#email', email)
  await page.fill('#name', `Pessoa Cadastro ${id}`)
  await page.fill('#password', 'curta')
  await expect(criterion(page, 'length')).toHaveClass('unmet')
  await page.fill('#password', `minha ${email.split('@')[0]} secreta`)
  await expect(criterion(page, 'length')).toHaveClass('met')
  await expect(criterion(page, 'personal')).toHaveClass('unmet')
  await page.fill('#password', password)
  await expect(criterion(page, 'personal')).toHaveClass('met')
  await expect(criterion(page, 'common')).toHaveClass('pending')
  await page.fill('#confirmation', 'outra senha qualquer aqui')
  await expect(criterion(page, 'confirmation')).toHaveClass('unmet')
  await page.check('#acceptTerms')
  await expectAccessible(page, testInfo, 'cadastro do IdP')

  // Confirmação diferente: recusada pelo servidor, e-mail e nome mantidos.
  await page.locator('button[type=submit]').click()
  await expect(page.locator('.alert-error')).toContainText('As senhas informadas não conferem.')
  await expect(page.locator('#email')).toHaveValue(email)
  await expect(criterion(page, 'confirmation')).toHaveClass('unmet')

  // Confirmação igual: conta criada, e-mail verificado.
  await page.fill('#password', password)
  await page.fill('#confirmation', password)
  await expect(criterion(page, 'confirmation')).toHaveClass('met')
  await page.check('#acceptTerms')
  await page.locator('button[type=submit]').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Verifique seu e-mail' })).toBeVisible()
  await page.goto(await mailLink(request, email, 'Confirme seu e-mail'))
  await expect(page.getByText('E-mail confirmado')).toBeVisible()

  // Login com a senha cadastrada e troca recusada por reuso (C4).
  await page.goto(`${env.idp}/login`)
  await page.fill('#username', email)
  await page.fill('#password', password)
  await page.locator('button[type=submit]').click()
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto(`${env.idp}/account/password`)
  await expect(criterion(page, 'history')).toContainText('Não ser igual a uma das suas 5 últimas senhas')
  await page.fill('#currentPassword', password)
  await page.fill('#password', password)
  await page.fill('#confirmation', password)
  await page.locator('button[type=submit]').click()
  await expect(page.locator('.alert-error')).toContainText('senhas recentes')
  await expect(criterion(page, 'history')).toHaveClass('unmet')
  await expectAccessible(page, testInfo, 'troca de senha do IdP')

  // Troca aceita.
  await page.fill('#currentPassword', password)
  await page.fill('#password', changed)
  await page.fill('#confirmation', changed)
  await expect(criterion(page, 'history')).toHaveClass('pending')
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/\/account\?passwordChanged/)

  // Redefinição pelo link do e-mail, com os critérios.
  await page.context().clearCookies()
  await page.goto(`${env.idp}/account/password/forgot`)
  await page.locator('#email').fill(email)
  await page.locator('button[type=submit]').click()
  await page.goto(await mailLink(request, email, 'Redefinição de senha'))
  await expect(page.locator('#password-criteria li')).toHaveCount(5)
  await page.fill('#password', reset)
  await page.fill('#confirmation', reset)
  await expect(criterion(page, 'length')).toHaveClass('met')
  await expect(criterion(page, 'confirmation')).toHaveClass('met')
  await page.locator('button[type=submit]').click()
  await expect(page.getByText('Sua senha foi redefinida')).toBeVisible()
})

test('senha inicial com olho no console', async ({ page }, testInfo) => {
  const admin = await createUser('senhas', { platformAdmin: true })
  const id = uniqueId()
  await signIn(page, admin)
  await page.goto('/platform/users')
  await page.getByRole('button', { name: 'Novo usuário' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill(`e2e.inicial.${id}@exemplo.local`)
  await dialog.getByRole('textbox', { name: 'Nome' }).fill(`E2E Inicial ${id}`)
  await dialog.getByRole('radio', { name: 'Senha inicial' }).check()
  const field = dialog.locator('input[autocomplete="new-password"]')
  await field.fill('ameixa madura no quintal 6604')
  await dialog.getByRole('button', { name: 'Mostrar senha' }).click()
  await expect(field).toHaveAttribute('type', 'text')
  await expect(field).toHaveValue('ameixa madura no quintal 6604')
  await expectAccessible(page, testInfo, 'senha inicial visível')
  await dialog.getByRole('button', { name: 'Ocultar senha' }).click()
  await expect(field).toHaveAttribute('type', 'password')
  await dialog.getByRole('button', { name: 'Criar usuário' }).click()
  await expect(page).toHaveURL(/\/platform\/users\/[\w-]+$/)
})
