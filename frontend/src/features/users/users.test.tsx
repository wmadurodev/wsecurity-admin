import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { adminSession } from '@/test/fixtures'
import { renderAt, withSession } from '@/test/render'
import { server } from '@/test/server'

import { availableActions } from './actions'
import type { User } from './api'

const ana: User = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ana@exemplo.local',
  name: 'Ana Souza',
  status: 'ACTIVE',
  locked: false,
  wsecurityAdmin: false,
  emailVerified: true,
  locale: 'pt-BR',
  lastLoginAt: '2026-10-12T13:05:00Z',
  createdAt: '2026-10-01T10:00:00Z',
  version: 3,
}

const page = (content: User[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })
const problem = (status: number, body: object) =>
  HttpResponse.json({ status, ...body }, { status, headers: { 'Content-Type': 'application/problem+json' } })

function stubDetail(user: User = ana) {
  server.use(http.get(`/bff/api/idp/users/${user.id}`, () => HttpResponse.json(user, { headers: { ETag: '"3"' } })))
}

describe('usuários', () => {
  it('lista com busca, filtro e ordenação vindos da URL', async () => {
    withSession(adminSession)
    let search = ''
    server.use(
      http.get('/bff/api/idp/users', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json(page([ana]))
      }),
    )
    renderAt('/platform/users?email=ana&status=DISABLED')

    expect(await screen.findByRole('link', { name: 'Ana Souza' })).toHaveAttribute('href', `/platform/users/${ana.id}`)
    expect(search).toContain('email=ana')
    expect(search).toContain('status=DISABLED')
    expect(search).toContain('sort=createdAt%2Cdesc')
    expect(screen.getByLabelText('Status')).toHaveValue('DISABLED')
    expect(screen.getByText('12/10/2026', { exact: false })).toBeInTheDocument()
  })

  it('criação mostra no campo o erro de política de senha e de e-mail duplicado', async () => {
    withSession(adminSession)
    server.use(http.get('/bff/api/idp/users', () => HttpResponse.json(page([]))))
    let attempts = 0
    server.use(
      http.post('/bff/api/idp/users', () => {
        attempts += 1
        return attempts === 1
          ? problem(422, { type: 'https://wsecurity.dev/problems/password-policy-violation', violations: ['common'] })
          : problem(409, { type: 'https://wsecurity.dev/problems/user-email-conflict', title: 'E-mail já cadastrado' })
      }),
    )
    renderAt('/platform/users')
    await userEvent.click(await screen.findByRole('button', { name: 'Novo usuário' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'novo@exemplo.local')
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Pessoa Nova')
    await userEvent.click(within(dialog).getByLabelText('Senha inicial'))
    await userEvent.type(within(dialog).getByLabelText('Senha inicial', { selector: 'input[type=password]' }), 'curta')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }))
    expect(await within(dialog).findByText('A senha deve ter de 12 a 128 caracteres.')).toBeInTheDocument()
    expect(attempts).toBe(0)

    const password = within(dialog).getByLabelText('Senha inicial', { selector: 'input[type=password]' })
    await userEvent.clear(password)
    await userEvent.type(password, 'senha123456789')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }))
    expect(await within(dialog).findByText(/muito comum/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }))
    expect(await within(dialog).findByText('Já existe um usuário com este e-mail.')).toBeInTheDocument()
  })

  it('convite cria o usuário sem senha e abre o detalhe', async () => {
    withSession(adminSession)
    stubDetail()
    let body: Record<string, unknown> = {}
    server.use(
      http.get('/bff/api/idp/users', () => HttpResponse.json(page([]))),
      http.post('/bff/api/idp/users', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(ana, { status: 201 })
      }),
    )
    const { router } = renderAt('/platform/users')
    await userEvent.click(await screen.findByRole('button', { name: 'Novo usuário' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'ana@exemplo.local')
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Ana Souza')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(`/platform/users/${ana.id}`))
    expect(body).toEqual({ email: 'ana@exemplo.local', name: 'Ana Souza', wsecurityAdmin: false })
  })

  it('ações conforme o status', () => {
    const labels = (user: User) => availableActions(user).map((action) => action.action)
    expect(labels(ana)).toEqual(['disable', 'password-reset', 'mfa-reset', 'delete'])
    expect(labels({ ...ana, status: 'DISABLED', locked: true })).toEqual([
      'enable',
      'unlock',
      'password-reset',
      'mfa-reset',
      'delete',
    ])
    expect(labels({ ...ana, status: 'PENDING_VERIFICATION' })).toEqual([
      'enable',
      'password-reset',
      'mfa-reset',
      'delete',
    ])
    expect(labels({ ...ana, status: 'DELETED' })).toEqual([])
    expect(availableActions(ana).find((action) => action.action === 'delete')?.strong).toBe(true)
  })

  it('desativa pelo diálogo de confirmação', async () => {
    withSession(adminSession)
    stubDetail()
    let disabled = false
    server.use(
      http.post(`/bff/api/idp/users/${ana.id}/disable`, () => {
        disabled = true
        return HttpResponse.json({ ...ana, status: 'DISABLED' })
      }),
    )
    renderAt(`/platform/users/${ana.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))
    await waitFor(() => expect(disabled).toBe(true))
  })

  it('exclusão exige digitar o e-mail', async () => {
    withSession(adminSession)
    stubDetail()
    renderAt(`/platform/users/${ana.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Q-05/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Excluir' })).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Digite/), 'ana@exemplo.local')
    expect(within(dialog).getByRole('button', { name: 'Excluir' })).toBeEnabled()
  })

  it('edição envia If-Match e mostra o aviso de 412', async () => {
    withSession(adminSession)
    stubDetail()
    let ifMatch: string | null = null
    server.use(
      http.patch(`/bff/api/idp/users/${ana.id}`, ({ request }) => {
        ifMatch = request.headers.get('If-Match')
        return problem(412, { title: 'Versão desatualizada' })
      }),
    )
    renderAt(`/platform/users/${ana.id}`)
    const name = await screen.findByLabelText('Nome')
    await userEvent.clear(name)
    await userEvent.type(name, 'Ana S.')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Este registro foi alterado por outra pessoa')).toBeInTheDocument()
    expect(ifMatch).toBe('"3"')
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument()
  })

  it('aba de eventos lista os eventos paginados', async () => {
    withSession(adminSession)
    stubDetail()
    server.use(
      http.get(`/bff/api/idp/users/${ana.id}/events`, ({ request }) => {
        expect(new URL(request.url).searchParams.has('aba')).toBe(false)
        return HttpResponse.json({
          content: [
            { id: 'e1', occurredAt: '2026-10-12T13:05:00Z', type: 'LOGIN_SUCCESS', outcome: 'SUCCESS', ip: '10.0.0.1' },
          ],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        })
      }),
    )
    renderAt(`/platform/users/${ana.id}?aba=eventos`)
    expect(await screen.findByText('Login')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
  })

  it('aba de acessos mostra tenants, papéis e permissões por módulo', async () => {
    withSession(adminSession)
    stubDetail()
    server.use(
      http.get(`/bff/users/${ana.id}/access`, () =>
        HttpResponse.json({
          sub: ana.id,
          tenants: [
            { slug: 'acme', name: 'Acme', roles: ['owner'], permissions: ['demo.orders:write', 'core.members:write'] },
          ],
        }),
      ),
    )
    renderAt(`/platform/users/${ana.id}?aba=acessos`)
    expect(await screen.findByRole('link', { name: 'Acme' })).toHaveAttribute('href', `/t/acme/members/${ana.id}`)
    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.getByText('core.members:write')).toBeInTheDocument()
    expect(screen.getByText('demo.orders:write')).toBeInTheDocument()
  })

  it('aba de acessos explica o 503 do cliente de serviço', async () => {
    withSession(adminSession)
    stubDetail()
    server.use(
      http.get(`/bff/users/${ana.id}/access`, () =>
        problem(503, {
          title: 'Consulta de acessos indisponível',
          detail: 'O cliente de serviço do console não está configurado.',
        }),
      ),
    )
    renderAt(`/platform/users/${ana.id}?aba=acessos`)
    expect(await screen.findByText('Consulta indisponível')).toBeInTheDocument()
  })
})
