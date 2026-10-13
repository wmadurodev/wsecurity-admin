import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { Session } from '@/lib/session'
import { adminSession, ownerSession } from '@/test/fixtures'
import { renderAt, withSession } from '@/test/render'
import { server } from '@/test/server'

import type { TenantRole } from './api'
import { featuresFromTenant } from './role-matrix'

const API = '/bff/api/authz/v1/tenants/padaria'
const page = <T,>(content: T[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })
const problem = (status: number, body: object) =>
  HttpResponse.json({ status, ...body }, { status, headers: { 'Content-Type': 'application/problem+json' } })

const atendente: TenantRole = {
  code: 'atendente',
  name: 'Atendente',
  scope: 'TENANT',
  dynamic: false,
  grants: [
    { feature: 'demo.orders', access: 'WRITE' },
    { feature: 'core.members', access: 'READ' },
  ],
  version: 4,
}
const roles: TenantRole[] = [
  { code: 'owner', name: 'Dono', scope: 'SYSTEM', dynamic: true, grants: [] },
  {
    code: 'viewer',
    name: 'Leitor',
    scope: 'GLOBAL',
    dynamic: false,
    grants: [
      { feature: 'demo.orders', access: 'READ' },
      { feature: 'demo.reports', access: 'READ' },
    ],
  },
  {
    code: 'auditor',
    name: 'Auditor',
    scope: 'GLOBAL',
    dynamic: false,
    grants: [{ feature: 'faturamento.notas', access: 'READ' }],
  },
  atendente,
  {
    code: 'caixa',
    name: 'Caixa',
    scope: 'TENANT',
    dynamic: false,
    grants: [{ feature: 'demo.reports', access: 'READ' }],
  },
]

/** Administrador do tenant sem `demo.reports` (só lê pedidos): o anti-escalonamento limita a matriz (0002/RN-07). */
const adminOfTenant: Session = {
  ...ownerSession,
  tenants: [
    {
      slug: 'padaria',
      name: 'Padaria',
      roles: ['admin'],
      permissions: [
        'core.roles:write',
        'core.members:write',
        'core.tenant:read',
        'core.audit:read',
        'demo.orders:write',
      ],
    },
  ],
}

function stubRoles() {
  server.use(
    http.get(API, () =>
      HttpResponse.json(
        { slug: 'padaria', name: 'Padaria', status: 'ACTIVE', modules: ['core', 'demo'], version: 2 },
        { headers: { ETag: '"2"' } },
      ),
    ),
    http.get(`${API}/roles`, () => HttpResponse.json(roles)),
    http.get(`${API}/roles/:code`, ({ params }) => {
      const role = roles.find((item) => item.code === params.code)
      return role
        ? HttpResponse.json(role, { headers: { ETag: `"${role.version ?? 0}"` } })
        : problem(404, { title: 'Papel não encontrado' })
    }),
  )
}

/** Catálogo da plataforma: `faturamento` não é contratado pela padaria. */
function stubCatalog() {
  const modules = [
    { code: 'core', name: 'Núcleo', enabled: true },
    { code: 'demo', name: 'Demonstração', enabled: true },
    { code: 'faturamento', name: 'Faturamento', enabled: true },
  ]
  const features: Record<string, object[]> = {
    core: [{ code: 'core.members', module: 'core', name: 'Membros', enabled: true }],
    demo: [
      { code: 'demo.orders', module: 'demo', name: 'Pedidos', enabled: true },
      { code: 'demo.reports', module: 'demo', name: 'Relatórios', enabled: true },
    ],
    faturamento: [{ code: 'faturamento.notas', module: 'faturamento', name: 'Notas', enabled: true }],
  }
  server.use(
    http.get('/bff/api/authz/admin/v1/modules', () => HttpResponse.json({ ...page(modules), size: 100 })),
    http.get('/bff/api/authz/admin/v1/modules/:module/features', ({ params }) =>
      HttpResponse.json(features[String(params.module)] ?? []),
    ),
  )
}

const access = (name: string) => screen.findByRole('radiogroup', { name: `Acesso a ${name}` })

describe('lista de papéis do tenant', () => {
  it('mostra a origem e, com core.roles:write, a criação', async () => {
    withSession(ownerSession)
    stubRoles()
    renderAt('/t/padaria/roles')
    const row = (await screen.findByRole('link', { name: 'atendente' })).closest('tr') as HTMLElement
    expect(within(row).getByText('do tenant')).toBeInTheDocument()
    const viewer = screen.getByRole('link', { name: 'viewer' }).closest('tr') as HTMLElement
    expect(within(viewer).getByText('global')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Novo papel' })).toBeInTheDocument()
  })

  it('só com leitura não há criação', async () => {
    withSession({
      ...ownerSession,
      tenants: [{ slug: 'padaria', name: 'Padaria', roles: ['leitor'], permissions: ['core.roles:read'] }],
    })
    stubRoles()
    renderAt('/t/padaria/roles')
    expect(await screen.findByRole('link', { name: 'atendente' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Novo papel' })).not.toBeInTheDocument()
  })
})

describe('matriz do papel do tenant (canGrant)', () => {
  it('dono: concede qualquer funcionalidade dos módulos contratados', async () => {
    withSession(ownerSession)
    stubRoles()
    renderAt('/t/padaria/roles/new')
    const reports = await access('demo.reports')
    expect(within(reports).getByRole('radio', { name: 'Escrita' })).toBeEnabled()
    // `auditor` concede faturamento.notas, mas faturamento não é contratado pela padaria.
    expect(screen.queryByRole('radiogroup', { name: 'Acesso a faturamento.notas' })).not.toBeInTheDocument()
  })

  it('administrador sem demo.reports: a linha fica desabilitada; WRITE implica READ', async () => {
    withSession(adminOfTenant)
    stubRoles()
    renderAt('/t/padaria/roles/new')
    const reports = await access('demo.reports')
    expect(within(reports).getByRole('radio', { name: 'Leitura' })).toBeDisabled()
    expect(within(reports).getByRole('radio', { name: 'Escrita' })).toBeDisabled()
    expect(reports).toHaveAccessibleDescription(/anti-escalonamento/)
    const orders = await access('demo.orders')
    expect(within(orders).getByRole('radio', { name: 'Leitura' })).toBeEnabled()
    expect(within(orders).getByRole('radio', { name: 'Escrita' })).toBeEnabled()
    const members = await access('core.members')
    expect(within(members).getByRole('radio', { name: 'Escrita' })).toBeEnabled()
  })

  it('administrador da plataforma: catálogo com nomes, só dos módulos contratados', async () => {
    withSession(adminSession)
    stubRoles()
    stubCatalog()
    renderAt('/t/padaria/roles/new')
    const reports = await access('Relatórios')
    expect(within(reports).getByRole('radio', { name: 'Escrita' })).toBeEnabled()
    expect(screen.getByRole('radiogroup', { name: 'Acesso a Membros' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Acesso a Notas' })).not.toBeInTheDocument()
  })

  it('features sem catálogo: permissões do chamador e concessões dos papéis, filtradas pelos módulos', () => {
    const codes = featuresFromTenant(['core.roles:write', 'demo.orders:read'], roles, ['core', 'demo']).map(
      (feature) => feature.code,
    )
    expect(codes.sort()).toEqual(['core.members', 'core.roles', 'demo.orders', 'demo.reports'])
    expect(featuresFromTenant([], roles, undefined).map((feature) => feature.code)).toContain('faturamento.notas')
  })
})

describe('papel do tenant: leitura, 412 e anti-escalonamento', () => {
  it('papel global aparece só para leitura, com as concessões', async () => {
    withSession(ownerSession)
    stubRoles()
    renderAt('/t/padaria/roles/viewer')
    expect(await screen.findByText('global (só leitura)')).toBeInTheDocument()
    const reports = await access('demo.reports')
    expect(within(reports).getByRole('radio', { name: 'Leitura' })).toBeChecked()
    expect(within(reports).getByRole('radio', { name: 'Leitura' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar papel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir papel' })).not.toBeInTheDocument()
  })

  it('papel do tenant com concessão que o chamador não tem: só leitura, com o motivo', async () => {
    withSession(adminOfTenant)
    stubRoles()
    renderAt('/t/padaria/roles/caixa')
    expect(await screen.findByText('Você não pode alterar este papel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar papel' })).not.toBeInTheDocument()
  })

  it('salva com If-Match e explica o 412', async () => {
    withSession(ownerSession)
    stubRoles()
    let ifMatch: string | null = null
    server.use(
      http.put(`${API}/roles/atendente`, ({ request }) => {
        ifMatch = request.headers.get('If-Match')
        return problem(412, { title: 'Versão desatualizada' })
      }),
    )
    renderAt('/t/padaria/roles/atendente')
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar papel' }))
    expect(await screen.findByText('Este registro foi alterado por outra pessoa')).toBeInTheDocument()
    expect(ifMatch).toBe('"4"')
  })

  it('explica a recusa do anti-escalonamento da API', async () => {
    withSession(adminOfTenant)
    stubRoles()
    server.use(
      http.post(`${API}/roles`, () =>
        problem(403, {
          type: 'https://wsecurity.dev/problems/privilege-escalation',
          title: 'Escalonamento de privilégio negado',
          detail: 'Você só pode conceder ou retirar permissões que possui.',
        }),
      ),
    )
    renderAt('/t/padaria/roles/new')
    await userEvent.type(await screen.findByLabelText('Código'), 'supervisor')
    await userEvent.type(screen.getByLabelText('Nome'), 'Supervisor')
    await userEvent.click(screen.getByRole('button', { name: 'Criar papel' }))
    expect(await screen.findByText('Escalonamento de privilégio negado')).toBeInTheDocument()
    expect(screen.getByText('Você só pode conceder ou retirar permissões que possui.')).toBeInTheDocument()
  })

  it('exclui com confirmação e mostra a recusa de papel atribuído', async () => {
    withSession(ownerSession)
    stubRoles()
    server.use(
      http.delete(`${API}/roles/atendente`, () =>
        problem(409, {
          type: 'https://wsecurity.dev/problems/role-in-use',
          title: 'Papel atribuído a membros',
          detail: 'Retire o papel dos membros antes de excluí-lo.',
        }),
      ),
    )
    renderAt('/t/padaria/roles/atendente')
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir papel' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir papel' }))
    expect(await screen.findByText('Papel atribuído a membros')).toBeInTheDocument()
  })
})

describe('auditoria do tenant', () => {
  it('leva titular, tipo e período para a URL e para a API', async () => {
    withSession(ownerSession)
    let search = new URLSearchParams()
    server.use(
      http.get(`${API}/audit-events`, ({ request }) => {
        search = new URL(request.url).searchParams
        return HttpResponse.json(
          page([
            {
              id: 'e1',
              occurredAt: '2026-10-12T10:00:00Z',
              type: 'ROLE_CREATED',
              outcome: 'SUCCESS',
              actorId: 'ator',
              details: { code: 'atendente' },
            },
          ]),
        )
      }),
    )
    const { router } = renderAt('/t/padaria/audit?type=ROLE_CREATED')
    expect(await screen.findByRole('button', { name: 'Papel criado' })).toBeInTheDocument()
    expect(search.get('type')).toBe('ROLE_CREATED')
    expect(screen.queryByLabelText('Tenant (slug)')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Titular (sub)'), 'sub-1')
    await userEvent.type(screen.getByLabelText('De'), '2026-10-01T00:00')
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }))
    await waitFor(() => expect(router.state.location.search).toContain('subject=sub-1'))
    await waitFor(() => expect(search.get('subject')).toBe('sub-1'))
    expect(search.get('from')).toBe(new Date('2026-10-01T00:00').toISOString())
    expect(search.has('de')).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'Papel criado' }))
    expect(within(screen.getByRole('dialog')).getByText(/"code": "atendente"/)).toBeInTheDocument()
  })

  it('sem core.audit:read a área é negada', async () => {
    withSession({
      ...ownerSession,
      tenants: [{ slug: 'padaria', name: 'Padaria', roles: ['leitor'], permissions: ['core.members:read'] }],
    })
    renderAt('/t/padaria/audit')
    expect(await screen.findByText('Acesso negado')).toBeInTheDocument()
  })
})
