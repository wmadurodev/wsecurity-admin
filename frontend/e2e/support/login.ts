import { type Page } from '@playwright/test'

import { NEW_PASSWORD, type Persona } from './data'
import { env } from './env'

export interface SignIn {
  /** Quantas vezes o formulário de login do IdP apareceu. */
  loginForms: number
  /** O BFF refez a autorização sem `wsecurity.admin` (recuo de escopo, DEC-03). */
  scopeFallback: boolean
}

/**
 * Entra pelo formulário real do IdP a partir de `path` e volta ao console. Trata a troca obrigatória de senha do
 * primeiro acesso (a persona passa a ter a nova senha) e o consentimento, se o IdP pedir.
 */
export async function signIn(page: Page, persona: Persona, path = '/'): Promise<SignIn> {
  const result: SignIn = { loginForms: 0, scopeFallback: false }
  page.on('request', (request) => {
    if (request.url().includes('/oauth2/authorization/wsecurity-basic')) {
      result.scopeFallback = true
    }
  })
  await page.goto(path)
  for (let step = 0; step < 10; step += 1) {
    await page.waitForLoadState('networkidle')
    const url = page.url()
    if (url.startsWith(env.baseURL) && !url.includes('/oauth2/') && !url.includes('/login/oauth2/')) {
      return result
    }
    if (await page.locator('#currentPassword').count()) {
      await page.fill('#currentPassword', persona.password)
      await page.fill('#password', NEW_PASSWORD)
      await page.fill('#confirmation', NEW_PASSWORD)
      persona.password = NEW_PASSWORD
      await page.locator('button[type=submit]').click()
    } else if (await page.locator('#username').count()) {
      result.loginForms += 1
      await page.fill('#username', persona.email)
      await page.fill('#password', persona.password)
      await page.locator('button[type=submit]').click()
    } else if (await page.getByRole('button', { name: 'Permitir' }).count()) {
      await page.getByRole('button', { name: 'Permitir' }).click()
    } else {
      await page.waitForTimeout(500)
    }
  }
  throw new Error(`Login de ${persona.email} não terminou: ${page.url()}`)
}
