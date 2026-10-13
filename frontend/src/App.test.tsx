import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { request } from '@/lib/api/client'
import { adminSession, limitedSession, ownerSession } from '@/test/fixtures'
import { renderAt, withSession } from '@/test/render'
import { server } from '@/test/server'

describe('SPA: rotas, guardas e layout', () => {
  afterEach(() => vi.restoreAllMocks())

  it('administrador da plataforma abre na plataforma, com o seletor e a barra lateral', async () => {
    withSession(adminSession)
    const { router } = renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Plataforma' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/platform')
    const selector = screen.getByLabelText('Contexto')
    expect(selector).toHaveValue('platform')
    expect(screen.getByRole('option', { name: 'Acme' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/platform/users')
    expect(screen.getByText('Ative o segundo fator de autenticação')).toBeInTheDocument()
  })

  it('dono de um só tenant cai direto nele e não vê a plataforma', async () => {
    withSession(ownerSession)
    const { router } = renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Visão geral' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/t/padaria')
    expect(screen.queryByRole('option', { name: 'Plataforma' })).not.toBeInTheDocument()
    expect(screen.queryByText('Ative o segundo fator de autenticação')).not.toBeInTheDocument()
  })

  it('administrador de vários tenants escolhe um', async () => {
    withSession({
      ...ownerSession,
      tenants: [
        ...ownerSession.tenants,
        { slug: 'loja', name: 'Loja', roles: ['admin'], permissions: ['core.tenant:read'] },
      ],
    })
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Escolha um tenant' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Loja/ })).toHaveAttribute('href', '/t/loja')
  })

  it.each([
    ['plataforma sem wsecurity.admin', ownerSession, '/platform/users'],
    ['tenant fora da sessão', ownerSession, '/t/outro'],
    ['tela sem a permissão', limitedSession, '/t/padaria/roles'],
  ])('mostra 403 para %s', async (_, session, path) => {
    withSession(session)
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: 'Acesso negado' })).toBeInTheDocument()
  })

  it('a barra lateral do tenant mostra só as seções permitidas', async () => {
    withSession(limitedSession)
    renderAt('/t/padaria/members')
    expect(await screen.findByRole('heading', { level: 1, name: 'Membros' })).toBeInTheDocument()
    const sections = screen.getByRole('navigation', { name: 'Seções' })
    expect(sections).toHaveTextContent('Membros')
    expect(sections).not.toHaveTextContent('Papéis')
    expect(sections).not.toHaveTextContent('Auditoria')
  })

  it('administrador da plataforma abre qualquer tenant', async () => {
    withSession(adminSession)
    renderAt('/t/qualquer/roles')
    expect(await screen.findByRole('heading', { level: 1, name: 'Papéis do tenant' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contexto')).toHaveValue('t:qualquer')
  })

  it('mostra a trilha da rota', async () => {
    withSession(adminSession)
    server.use(
      http.get('/bff/api/authz/admin/v1/modules/vendas', () =>
        HttpResponse.json({ code: 'vendas', name: 'Vendas', enabled: true }),
      ),
      http.get('/bff/api/authz/admin/v1/modules/vendas/features', () => HttpResponse.json([])),
    )
    renderAt('/platform/modules/vendas')
    await screen.findByRole('heading', { level: 1, name: 'Vendas' })
    const trail = screen.getByRole('navigation', { name: 'Trilha' })
    expect(trail).toHaveTextContent('Plataforma')
    expect(trail).toHaveTextContent('Módulos')
    expect(trail).toHaveTextContent('vendas')
  })

  it('rota desconhecida mostra 404', async () => {
    withSession(adminSession)
    renderAt('/nao/existe')
    expect(await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
  })

  it('sem acesso administrativo vai para /no-access', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign })
    withSession({ ...ownerSession, tenants: [] })
    renderAt('/')
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/no-access'))
  })

  it('um 401 em qualquer chamada mostra o aviso de sessão expirada', async () => {
    withSession(adminSession)
    server.use(http.get('/bff/api/idp/users', () => new HttpResponse(null, { status: 401 })))
    renderAt('/platform')
    await screen.findByRole('heading', { level: 1, name: 'Plataforma' })
    await expect(request('get', '/bff/api/idp/users')).rejects.toMatchObject({ status: 401 })
    expect(await screen.findByText('Sua sessão expirou')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar de novo' })).toBeInTheDocument()
  })

  it('sai com o cabeçalho CSRF e segue para o logout do IdP', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign })
    document.cookie = 'XSRF-TOKEN=token-csrf'
    let header: string | null = null
    withSession(adminSession)
    server.use(
      http.post('/bff/logout', ({ request: call }) => {
        header = call.headers.get('X-XSRF-TOKEN')
        return HttpResponse.json({ redirectUrl: 'http://localhost:9000/connect/logout?x=1' })
      }),
    )
    renderAt('/platform')
    const { default: userEvent } = await import('@testing-library/user-event')
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('http://localhost:9000/connect/logout?x=1'))
    expect(header).toBe('token-csrf')
  })
})
