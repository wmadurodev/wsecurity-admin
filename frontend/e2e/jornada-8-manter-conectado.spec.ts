import { type Browser, type Cookie, expect, test } from '@playwright/test'

import { createTenant, createUser, type Persona } from './support/data'
import { env } from './support/env'
import { signIn } from './support/login'

const THIRTY_DAYS = 30 * 86_400

/**
 * Jornada 8 (0009/RNF-TST-02): "Manter conectado neste navegador". Fechar o navegador apaga os cookies de sessão e
 * mantém só os persistentes. Com a opção, o cookie do IdP (`WSECSESSION`) é persistente e o console volta sem pedir a
 * senha; o do console (`WSADMIN_SESSION`) continua de sessão (0009/DEC-02). Sem a opção, a senha é pedida de novo.
 */
test('com "Manter conectado", reabrir o navegador não pede a senha', async ({ browser }) => {
  const owner = await createUser('lembrado')
  const tenant = await createTenant(owner)

  const cookies = await firstVisit(browser, owner, true)
  const idp = cookies.find((cookie) => cookie.name === 'WSECSESSION')
  const bff = cookies.find((cookie) => cookie.name.endsWith('WSADMIN_SESSION'))
  expect(idp?.expires).toBeGreaterThan(Date.now() / 1000 + THIRTY_DAYS - 300)
  expect(idp?.httpOnly).toBe(true)
  expect(bff?.expires).toBe(-1)

  const reopened = await browser.newContext({ baseURL: env.baseURL })
  await reopened.addCookies(persistent(cookies))
  const page = await reopened.newPage()
  const login = await signIn(page, owner, `/t/${tenant.slug}`)
  expect(login.loginForms).toBe(0)
  await expect(page.getByRole('heading', { level: 1, name: tenant.name })).toBeVisible()
  await reopened.close()
})

test('sem "Manter conectado", reabrir o navegador pede a senha', async ({ browser }) => {
  const owner = await createUser('nao-lembrado')
  const tenant = await createTenant(owner)

  const cookies = await firstVisit(browser, owner, false)
  expect(persistent(cookies).map((cookie) => cookie.name)).not.toContain('WSECSESSION')

  const reopened = await browser.newContext({ baseURL: env.baseURL })
  await reopened.addCookies(persistent(cookies))
  const page = await reopened.newPage()
  const login = await signIn(page, owner, `/t/${tenant.slug}`)
  expect(login.loginForms).toBe(1)
  await expect(page.getByRole('heading', { level: 1, name: tenant.name })).toBeVisible()
  await reopened.close()
})

/** Primeiro acesso num navegador novo; devolve os cookies que ele tinha ao ser "fechado". */
async function firstVisit(browser: Browser, persona: Persona, rememberMe: boolean): Promise<Cookie[]> {
  const context = await browser.newContext({ baseURL: env.baseURL })
  const page = await context.newPage()
  const login = await signIn(page, persona, '/', { rememberMe })
  expect(login.loginForms).toBe(1)
  const cookies = await context.cookies()
  await context.close()
  return cookies
}

/** O que sobrevive ao fechamento do navegador: só cookies com data de expiração. */
function persistent(cookies: Cookie[]): Cookie[] {
  return cookies.filter((cookie) => cookie.expires > 0)
}
