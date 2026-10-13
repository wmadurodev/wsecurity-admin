import { expect, test } from '@playwright/test'

import { createTenant, createUser } from './support/data'
import { signIn } from './support/login'
import { fetchFromPage, JWT, recordBffResponses, recordCspViolations } from './support/security'

/**
 * Jornada 6 (04 §6.1; RN-01, RNF-SEG-01, RNF-SEG-02, RNF-SEG-04): nenhum token no navegador nem nas respostas do BFF,
 * cookie de sessão `HttpOnly`, CSP presente e sem violações, `POST` sem CSRF recusado e rota de plataforma recusada
 * no BFF para usuário comum.
 */
test.describe('segurança no navegador', () => {
  test('administrador da plataforma: nenhum token no navegador, cookie HttpOnly, CSP e CSRF', async ({ page }) => {
    const admin = await createUser('seguranca', { platformAdmin: true })
    const bff = recordBffResponses(page)
    await recordCspViolations(page)

    await signIn(page, admin)
    const index = await page.goto('/platform/users')
    await expect(page.getByRole('heading', { level: 1, name: 'Usuários' })).toBeVisible()
    await page.goto(`/platform/users/${admin.id}`)
    await expect(page.getByText(admin.email).first()).toBeVisible()
    for (const path of ['/platform/tenants', '/platform/clients', '/platform/roles', '/platform/audit']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }

    // CSP restritiva no index.html (RNF-SEG-04) e nenhuma violação registrada
    const csp = index?.headers()['content-security-policy'] ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toContain('unsafe-inline')
    expect(csp).not.toContain('unsafe-eval')
    expect(await page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations)).toEqual([])

    // Nenhum token no armazenamento, nos cookies legíveis por JS nem nas respostas do BFF (RN-01)
    const storage = await page.evaluate(() => ({
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
      cookies: document.cookie,
    }))
    expect(storage.local).not.toMatch(JWT)
    expect(storage.session).not.toMatch(JWT)
    expect(storage.cookies).not.toMatch(JWT)
    expect(storage.cookies).not.toContain('WSADMIN_SESSION')
    expect(bff.length).toBeGreaterThan(5)
    for (const body of bff) {
      expect(body, body.split('\n')[0]).not.toMatch(JWT)
    }

    // Cookie de sessão próprio, HttpOnly e SameSite=Lax (RNF-SEG-01)
    const session = (await page.context().cookies()).find((cookie) => cookie.name.endsWith('WSADMIN_SESSION'))
    expect(session?.httpOnly).toBe(true)
    expect(session?.sameSite).toBe('Lax')

    // POST sem X-XSRF-TOKEN → 403 (RNF-SEG-02); com o cabeçalho, o CSRF passa e a API responde
    expect(await fetchFromPage(page, 'POST', '/bff/api/authz/admin/v1/tenants', { body: {}, csrf: false })).toBe(403)
    expect(await fetchFromPage(page, 'POST', '/bff/api/authz/admin/v1/tenants', { body: {} })).toBe(400)
  })

  test('usuário comum: rota de plataforma recusada no BFF', async ({ page }) => {
    const owner = await createUser('comum')
    await createTenant(owner)

    await signIn(page, owner)
    expect(await fetchFromPage(page, 'GET', '/bff/api/idp/users')).toBe(403)
    expect(await fetchFromPage(page, 'GET', '/bff/api/authz/admin/v1/tenants')).toBe(403)
  })
})
