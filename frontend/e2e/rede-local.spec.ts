import { expect, test } from '@playwright/test'

import { createUser, uniqueId } from './support/data'
import { env } from './support/env'
import { signIn } from './support/login'

/**
 * Acesso pela rede local (fase 0005, RF-REDE-01, 02, 07 e 08): o navegador roda num contêiner fora da rede do host e
 * abre o console pelo IP da máquina, como uma outra máquina da rede. Só roda pelo scripts/e2e-rede.sh do
 * wsecurity-infra (E2E_REDE=sim), que aponta E2E_BASE_URL, E2E_IDP_URL e E2E_AUTHZ_URL para o IP.
 */
test.skip(process.env.E2E_REDE !== 'sim', 'só pelo scripts/e2e-rede.sh do wsecurity-infra (modo rede)')

const mailpit = process.env.E2E_MAILPIT_URL ?? ''

test('outra máquina da rede: login, telas, cliente com redirect no IP e logout', async ({ page }) => {
  const host = new URL(env.baseURL).hostname
  expect(host).not.toBe('localhost')

  const admin = await createUser('rede', { platformAdmin: true })
  const loginPages: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/login') && request.isNavigationRequest()) {
      loginPages.push(request.url())
    }
  })

  await page.goto('/login-error')
  // Como numa máquina remota: HTTP fora de localhost não é contexto seguro.
  expect(await page.evaluate(() => window.isSecureContext)).toBe(false)

  await signIn(page, admin)
  await expect(page).toHaveURL(new RegExp(`^${env.baseURL}/platform$`))
  expect(loginPages.some((url) => url.startsWith(`${env.idp}/login`))).toBe(true)

  await page.goto('/platform/users')
  await expect(page.getByRole('heading', { level: 1, name: 'Usuários' })).toBeVisible()

  // Cliente com redirect http no IP: aceito pelo formulário (host do console) e pelo IdP (http-redirect-hosts).
  const name = `E2E rede ${uniqueId()}`
  await page.goto('/platform/clients/new')
  await page.getByRole('textbox', { name: 'Nome' }).fill(name)
  await page.getByRole('textbox', { name: 'URIs de retorno', exact: true }).fill(`http://${host}:9999/cb`)
  await page.getByRole('button', { name: 'Registrar cliente' }).click()
  // Cliente confidencial: o segredo aparece uma única vez.
  await page.getByRole('button', { name: /Já guardei/ }).click()
  await expect(page).toHaveURL(/\/platform\/clients\/[\w-]+$/)
  await expect(page.getByText(name).first()).toBeVisible()

  // Outro host em http continua recusado já no formulário.
  await page.goto('/platform/clients/new')
  await page.getByRole('textbox', { name: 'Nome' }).fill(`${name} inválido`)
  await page.getByRole('textbox', { name: 'URIs de retorno', exact: true }).fill('http://10.255.255.1:9999/cb')
  await page.getByRole('button', { name: 'Registrar cliente' }).click()
  await expect(page.getByRole('alert').filter({ hasText: /URI inválida: http:\/\/10\.255\.255\.1/ })).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.locator('#username')).toBeVisible()
  expect(page.url().startsWith(`${env.idp}/`)).toBe(true)
  expect((await page.request.get('/bff/session')).status()).toBe(401)
})

test('emissores e e-mails no endereço da rede', async ({ page, request }) => {
  const idp = await (await request.get(`${env.idp}/.well-known/openid-configuration`)).json()
  expect(idp.issuer).toBe(env.idp)
  const authz = await (await request.get(`${env.authz}/.well-known/oauth-authorization-server`)).json()
  expect(authz.issuer).toBe(env.authz)

  test.skip(mailpit === '', 'E2E_MAILPIT_URL não definido')
  const user = await createUser('rede-email')
  await page.goto(`${env.idp}/account/password/forgot`)
  await page.locator('#email').fill(user.email)
  await page.locator('button[type=submit]').click()

  let text = ''
  for (let attempt = 0; attempt < 30 && !text.includes(env.idp); attempt += 1) {
    const search = await (
      await request.get(`${mailpit}/api/v1/search`, { params: { query: `to:"${user.email}"` } })
    ).json()
    const id = search.messages?.[0]?.ID
    text = id ? ((await (await request.get(`${mailpit}/api/v1/message/${id}`)).json()).Text ?? '') : ''
    if (!text.includes(env.idp)) {
      await page.waitForTimeout(1000)
    }
  }
  expect(text).toContain(`${env.idp}/account/password/reset?token=`)
  expect(text).not.toContain('localhost')
})
