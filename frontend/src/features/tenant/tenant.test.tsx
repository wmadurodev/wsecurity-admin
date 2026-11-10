import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { Session } from '@/lib/session'
import { adminSession, limitedSession, ownerSession } from '@/test/fixtures'
import { renderAt, withSession } from '@/test/render'
import { server } from '@/test/server'

const API = '/bff/api/authz/v1/tenants/padaria'
const page = <T,>(content: T[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })
const problem = (status: number, body: object) =>
  HttpResponse.json({ status, ...body }, { status, headers: { 'Content-Type': 'application/problem+json' } })

const SUB = 'aaaaaaaa-1111-4111-8111-111111111111'
const member = {
  subject: SUB,
  subjectType: 'USER',
  status: 'ACTIVE',
  roles: ['owner'],
  createdAt: '2026-10-12T10:00:00Z',
  version: 3,
}
const withProfile = { ...member, name: 'Bruno Lima', email: 'bruno@exemplo.com', profileStatus: 'AVAILABLE' }
const roles = [
  { code: 'owner', name: 'Dono', scope: 'SYSTEM', dynamic: false, grants: [] },
  {
    code: 'viewer',
    name: 'Leitor',
    scope: 'GLOBAL',
    dynamic: false,
    grants: [{ feature: 'core.members', access: 'READ' }],
  },
  {
    code: 'financeiro',
    name: 'Financeiro',
    scope: 'TENANT',
    dynamic: false,
    grants: [{ feature: 'fin.notas', access: 'WRITE' }],
  },
]

/** Gestor de membros sem ser dono: o anti-escalonamento (0002/RN-07) limita os papéis atribuíveis. */
const managerSession: Session = {
  ...ownerSession,
  tenants: [
    {
      slug: 'padaria',
      name: 'Padaria',
      roles: ['gestor'],
      permissions: ['core.members:write', 'core.roles:read', 'core.tenant:read'],
    },
  ],
}

function stubTenantArea() {
  server.use(
    http.get(API, () =>
      HttpResponse.json(
        { slug: 'padaria', name: 'Padaria', plan: 'basico', status: 'ACTIVE', modules: ['core', 'demo'], version: 2 },
        { headers: { ETag: '"2"' } },
      ),
    ),
    http.get(`${API}/members`, () => HttpResponse.json({ ...page([member]), totalElements: 7 })),
    http.get(`${API}/members/${SUB}`, () => HttpResponse.json(member, { headers: { ETag: '"3"' } })),
    http.get(`${API}/roles`, () => HttpResponse.json(roles)),
  )
}

describe('visão geral do tenant', () => {
  it('mostra dados, total de membros e papéis do chamador; o dono edita os dados', async () => {
    withSession(ownerSession)
    stubTenantArea()
    renderAt('/t/padaria')
    expect(await screen.findByRole('heading', { level: 1, name: 'Padaria' })).toBeInTheDocument()
    expect(await screen.findByText('7')).toBeInTheDocument()
    expect(screen.getByText('demo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar dados' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Atalhos' })).getByRole('link', { name: 'Auditoria' }),
    ).toBeInTheDocument()
  })

  it('sem core.tenant:write não há edição', async () => {
    withSession(managerSession)
    stubTenantArea()
    renderAt('/t/padaria')
    expect(await screen.findByRole('heading', { level: 1, name: 'Padaria' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar dados' })).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Atalhos' })).queryByRole('link', { name: 'Auditoria' }),
    ).not.toBeInTheDocument()
  })
})

describe('membros', () => {
  it('para o administrador do tenant, mostra o sub abreviado com "copiar" e a ação de adicionar', async () => {
    withSession(ownerSession)
    stubTenantArea()
    renderAt('/t/padaria/members')
    expect(await screen.findByText('aaaaaaaa…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Copiar ${SUB}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar membro' })).toBeInTheDocument()
  })

  it.each([
    ['dono do tenant', ownerSession],
    ['administrador da plataforma', adminSession],
  ])(
    'para o %s, mostra nome e e-mail vindos da API de membros, sem consultar o IdP (fase 0008)',
    async (_, session) => {
      withSession(session)
      stubTenantArea()
      let idpCalls = 0
      server.use(
        http.get(`${API}/members`, () => HttpResponse.json(page([withProfile]))),
        http.get('/bff/api/idp/users/:id', () => {
          idpCalls++
          return HttpResponse.json({})
        }),
      )
      renderAt('/t/padaria/members')
      expect(await screen.findByText('bruno@exemplo.com')).toBeInTheDocument()
      expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Abrir o membro bruno@exemplo.com' })).toBeInTheDocument()
      expect(idpCalls).toBe(0)
    },
  )

  it.each([
    ['NOT_FOUND', 'Usuário não encontrado no IdP'],
    ['UNAVAILABLE', 'Dados do IdP indisponíveis no momento'],
  ])('com profileStatus %s, mostra o sub e o aviso', async (profileStatus, notice) => {
    withSession(ownerSession)
    stubTenantArea()
    server.use(http.get(`${API}/members`, () => HttpResponse.json(page([{ ...member, profileStatus }]))))
    renderAt('/t/padaria/members')
    expect(await screen.findByText(notice)).toBeInTheDocument()
    expect(screen.getByText('aaaaaaaa…')).toBeInTheDocument()
  })

  it('conta de serviço aparece pelo client_id, sem aviso', async () => {
    withSession(ownerSession)
    stubTenantArea()
    server.use(
      http.get(`${API}/members`, () =>
        HttpResponse.json(
          page([{ ...member, subject: 'svc-faturas', subjectType: 'CLIENT', profileStatus: 'NOT_APPLICABLE' }]),
        ),
      ),
    )
    renderAt('/t/padaria/members')
    expect(await screen.findByText('svc-faturas')).toBeInTheDocument()
    expect(screen.queryByText(/IdP/)).not.toBeInTheDocument()
  })

  it('com papel só de leitura, lista sem ações de escrita', async () => {
    withSession(limitedSession)
    stubTenantArea()
    renderAt('/t/padaria/members')
    expect(await screen.findByText('aaaaaaaa…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar membro' })).not.toBeInTheDocument()
  })

  it('o filtro de tipo vai para a API', async () => {
    withSession(ownerSession)
    stubTenantArea()
    let type: string | null = null
    server.use(
      http.get(`${API}/members`, ({ request }) => {
        type = new URL(request.url).searchParams.get('subjectType')
        return HttpResponse.json(page([member]))
      }),
    )
    renderAt('/t/padaria/members')
    await userEvent.selectOptions(await screen.findByLabelText('Tipo'), 'CLIENT')
    await waitFor(() => expect(type).toBe('CLIENT'))
  })
})

describe('adicionar membro', () => {
  it('desabilita os papéis que o chamador não pode atribuir (0002/RN-07)', async () => {
    withSession(managerSession)
    stubTenantArea()
    renderAt('/t/padaria/members')
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar membro' }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByRole('checkbox', { name: /Leitor/ })).toBeEnabled()
    expect(within(dialog).getByRole('checkbox', { name: /Dono/ })).toBeDisabled()
    expect(within(dialog).getByRole('checkbox', { name: /Financeiro/ })).toBeDisabled()
  })

  it('envia por e-mail com convite, explica o 409 e informa o e-mail ao adicionar', async () => {
    withSession(ownerSession)
    stubTenantArea()
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.post(`${API}/members`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        bodies.push(body)
        return body.email === 'ja@exemplo.com'
          ? problem(409, { type: 'https://wsecurity.dev/problems/membership-conflict', title: 'Já é membro' })
          : HttpResponse.json({ ...member, subject: 'novo', roles: ['viewer'] }, { status: 201 })
      }),
    )
    renderAt('/t/padaria/members')
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar membro' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'ja@exemplo.com')
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Leitor/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }))
    expect(await within(dialog).findByText(/Já é membro deste tenant/)).toBeInTheDocument()

    await userEvent.clear(within(dialog).getByLabelText('E-mail'))
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'bia@exemplo.com')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }))
    expect(await screen.findByText(/bia@exemplo.com adicionado ao tenant/)).toBeInTheDocument()
    expect(bodies[1]).toMatchObject({ email: 'bia@exemplo.com', invite: true, roles: ['viewer'] })
  })
})

describe('detalhe do membro', () => {
  it('412 na troca de papéis oferece recarregar', async () => {
    withSession(ownerSession)
    stubTenantArea()
    let ifMatch: string | null = null
    server.use(
      http.put(`${API}/members/${SUB}/roles`, ({ request }) => {
        ifMatch = request.headers.get('If-Match')
        return problem(412, { title: 'Versão desatualizada' })
      }),
    )
    renderAt(`/t/padaria/members/${SUB}`)
    await userEvent.click(await screen.findByRole('checkbox', { name: /Leitor/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar papéis' }))
    expect(await screen.findByText('Este registro foi alterado por outra pessoa')).toBeInTheDocument()
    expect(ifMatch).toBe('"3"')
  })

  it('explica o erro do último dono ao remover', async () => {
    withSession(ownerSession)
    stubTenantArea()
    server.use(
      http.delete(`${API}/members/${SUB}`, () =>
        problem(409, {
          type: 'https://wsecurity.dev/problems/tenant-last-owner',
          title: 'O tenant ficaria sem dono',
        }),
      ),
    )
    renderAt(`/t/padaria/members/${SUB}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Remover do tenant' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }))
    expect(await screen.findByText(/Atribua o papel owner a outro membro/)).toBeInTheDocument()
  })

  it('define e remove a expiração', async () => {
    withSession(ownerSession)
    stubTenantArea()
    const bodies: unknown[] = []
    server.use(
      http.patch(`${API}/members/${SUB}`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(member)
      }),
    )
    renderAt(`/t/padaria/members/${SUB}`)
    const input = await screen.findByLabelText('Expira em')
    await userEvent.type(input, '2099-01-31T10:00')
    await userEvent.click(screen.getByRole('button', { name: 'Definir expiração' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect((bodies[0] as { expiresAt: string }).expiresAt).toMatch(/^2099-01-31T/)
  })

  it('com papel só de leitura, não há ações de escrita', async () => {
    withSession(limitedSession)
    stubTenantArea()
    renderAt(`/t/padaria/members/${SUB}`)
    expect(await screen.findByText('Sem expiração.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suspender' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar papéis' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver usuário' })).not.toBeInTheDocument()
  })

  it('o administrador da plataforma vê o link para o usuário', async () => {
    withSession(adminSession)
    stubTenantArea()
    renderAt(`/t/padaria/members/${SUB}`)
    expect(await screen.findByRole('link', { name: 'Ver usuário' })).toHaveAttribute('href', `/platform/users/${SUB}`)
  })

  it('o detalhe mostra nome e e-mail vindos da API para o dono (fase 0008)', async () => {
    withSession(ownerSession)
    stubTenantArea()
    server.use(http.get(`${API}/members/${SUB}`, () => HttpResponse.json(withProfile, { headers: { ETag: '"3"' } })))
    renderAt(`/t/padaria/members/${SUB}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Bruno Lima' })).toBeInTheDocument()
    expect(screen.getByText('bruno@exemplo.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Copiar ${SUB}` })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver usuário' })).not.toBeInTheDocument()
  })

  it('o detalhe avisa quando o IdP está indisponível', async () => {
    withSession(ownerSession)
    stubTenantArea()
    server.use(
      http.get(`${API}/members/${SUB}`, () =>
        HttpResponse.json({ ...member, profileStatus: 'UNAVAILABLE' }, { headers: { ETag: '"3"' } }),
      ),
    )
    renderAt(`/t/padaria/members/${SUB}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Membro' })).toBeInTheDocument()
    expect(screen.getByText('Dados do IdP indisponíveis no momento')).toBeInTheDocument()
  })
})

describe('situação da conta no IdP (fase 0010)', () => {
  const disabled = { ...withProfile, accountStatus: 'DISABLED' }

  it.each([
    [{ accountStatus: 'DISABLED' }, 'Desativado pela plataforma'],
    [{ accountStatus: 'DELETED', accountDeletedBy: 'PLATFORM' }, 'Excluído pela plataforma'],
    [{ accountStatus: 'DELETED', accountDeletedBy: 'USER' }, 'Conta excluída pelo usuário'],
  ])('a lista mostra a situação da conta no lugar do status do vínculo (%o)', async (account, label) => {
    withSession(ownerSession)
    stubTenantArea()
    server.use(http.get(`${API}/members`, () => HttpResponse.json(page([{ ...withProfile, ...account }]))))
    renderAt('/t/padaria/members')
    expect(await screen.findByText(label)).toBeInTheDocument()
    expect(screen.getByText('bruno@exemplo.com')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).queryByText('Ativo')).not.toBeInTheDocument()
  })

  it('conta ativa continua com o status do vínculo', async () => {
    withSession(ownerSession)
    stubTenantArea()
    server.use(http.get(`${API}/members`, () => HttpResponse.json(page([{ ...withProfile, accountStatus: 'ACTIVE' }]))))
    renderAt('/t/padaria/members')
    expect(await screen.findByText('Ativo')).toBeInTheDocument()
  })

  it('para o dono, o detalhe da conta desativada explica e não oferece ações', async () => {
    withSession(ownerSession)
    stubTenantArea()
    server.use(http.get(`${API}/members/${SUB}`, () => HttpResponse.json(disabled, { headers: { ETag: '"3"' } })))
    renderAt(`/t/padaria/members/${SUB}`)
    expect(await screen.findByText(/foi desativada pelo administrador da plataforma/)).toBeInTheDocument()
    expect(screen.getByText('Desativado pela plataforma')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suspender' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover do tenant' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar papéis' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Definir expiração' })).not.toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.queryByText(/você ainda pode alterar/)).not.toBeInTheDocument()
  })

  it('o administrador da plataforma vê o aviso e continua com as ações', async () => {
    withSession(adminSession)
    stubTenantArea()
    server.use(
      http.get(`${API}/members/${SUB}`, () =>
        HttpResponse.json(
          { ...withProfile, accountStatus: 'DELETED', accountDeletedBy: 'PLATFORM' },
          { headers: { ETag: '"3"' } },
        ),
      ),
    )
    renderAt(`/t/padaria/members/${SUB}`)
    expect(await screen.findByText(/foi excluída pelo administrador da plataforma/)).toBeInTheDocument()
    expect(screen.getByText(/você ainda pode alterar ou remover este vínculo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover do tenant' })).toBeInTheDocument()
  })

  it('conta anonimizada mostra o sub com o aviso de dados removidos', async () => {
    withSession(ownerSession)
    stubTenantArea()
    server.use(
      http.get(`${API}/members`, () =>
        HttpResponse.json(
          page([{ ...member, profileStatus: 'NOT_FOUND', accountStatus: 'DELETED', accountDeletedBy: 'USER' }]),
        ),
      ),
    )
    renderAt('/t/padaria/members')
    expect(await screen.findByText('Dados pessoais removidos após a exclusão')).toBeInTheDocument()
    expect(screen.queryByText('Usuário não encontrado no IdP')).not.toBeInTheDocument()
  })

  it('o 409 member-account-inactive recarrega o detalhe com a situação nova', async () => {
    withSession(ownerSession)
    stubTenantArea()
    let calls = 0
    server.use(
      http.get(`${API}/members/${SUB}`, () => {
        calls += 1
        return HttpResponse.json(calls === 1 ? withProfile : disabled, { headers: { ETag: '"3"' } })
      }),
      http.post(`${API}/members/${SUB}/suspend`, () =>
        problem(409, {
          type: 'https://wsecurity.dev/problems/member-account-inactive',
          title: 'A conta do membro está desativada ou excluída',
          accountStatus: 'DISABLED',
        }),
      ),
    )
    const user = userEvent.setup()
    renderAt(`/t/padaria/members/${SUB}`)
    await user.click(await screen.findByRole('button', { name: 'Suspender' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Suspender' }))
    expect(await screen.findByText(/foi desativada pelo administrador da plataforma/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Suspender' })).not.toBeInTheDocument())
  })
})
