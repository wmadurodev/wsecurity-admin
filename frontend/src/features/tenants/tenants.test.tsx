import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { adminSession } from '@/test/fixtures'
import { renderAt, withSession } from '@/test/render'
import { server } from '@/test/server'

import { SLUG, suggestSlug } from './api'

const page = <T,>(content: T[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })
const problem = (status: number, body: object) =>
  HttpResponse.json({ status, ...body }, { status, headers: { 'Content-Type': 'application/problem+json' } })
const globex = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'globex',
  name: 'Globex',
  plan: 'basico',
  status: 'ACTIVE',
  settings: {},
  modules: ['demo'],
  createdAt: '2026-10-12T10:00:00Z',
  version: 1,
}

function stubCatalog() {
  server.use(
    http.get('/bff/api/authz/admin/v1/modules', () =>
      HttpResponse.json(
        page([
          { code: 'core', name: 'Núcleo', system: true, enabled: true },
          { code: 'demo', name: 'Demo', system: false, enabled: true },
          { code: 'faturamento', name: 'Faturamento', system: false, enabled: true },
        ]),
      ),
    ),
  )
}

function stubTenant(tenant = globex) {
  server.use(
    http.get(`/bff/api/authz/admin/v1/tenants/${tenant.slug}`, () =>
      HttpResponse.json(tenant, { headers: { ETag: '"1"' } }),
    ),
    http.get(`/bff/api/authz/admin/v1/tenants/${tenant.slug}/modules`, () =>
      HttpResponse.json([
        { module: 'core', implicit: true },
        { module: 'demo', implicit: false, enabledAt: '2026-10-12T10:00:00Z' },
      ]),
    ),
  )
}

describe('slug', () => {
  it('segue 0002/RN-09 e é sugerido a partir do nome', () => {
    expect(SLUG.test('globex')).toBe(true)
    expect(SLUG.test('ab')).toBe(false)
    expect(SLUG.test('-globex')).toBe(false)
    expect(SLUG.test('Globex')).toBe(false)
    expect(suggestSlug('Padaria São João!')).toBe('padaria-sao-joao')
    expect(suggestSlug('  Ágape & Cia  ')).toBe('agape-cia')
  })
})

describe('criação de tenant', () => {
  it('escolhe o dono pelo autocompletar, sugere o slug e mostra o 409 no campo', async () => {
    withSession(adminSession)
    stubCatalog()
    let body: Record<string, unknown> = {}
    server.use(
      http.get('/bff/api/idp/users', ({ request }) => {
        const email = new URL(request.url).searchParams.get('email') ?? ''
        return HttpResponse.json(
          page(
            email.startsWith('an')
              ? [{ id: 'u-ana', email: 'ana.souza@exemplo.local', name: 'Ana Souza', status: 'ACTIVE' }]
              : [],
          ),
        )
      }),
      http.post('/bff/api/authz/admin/v1/tenants', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return problem(409, { title: 'Slug em uso', detail: 'O slug globex já está em uso ou reservado.' })
      }),
    )
    renderAt('/platform/tenants/new')
    await userEvent.type(await screen.findByLabelText('Nome'), 'Globex S.A.')
    expect(screen.getByLabelText('Slug')).toHaveValue('globex-s-a')
    await userEvent.clear(screen.getByLabelText('Slug'))
    await userEvent.type(screen.getByLabelText('Slug'), 'globex')
    await userEvent.click(await screen.findByRole('checkbox', { name: /Demo/ }))
    expect(screen.queryByRole('checkbox', { name: /Núcleo/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Criar tenant' }))
    expect(await screen.findByText('Escolha o dono do tenant.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Dono'), 'an')
    await userEvent.click(await screen.findByRole('option', { name: /Ana Souza/ }))
    expect(screen.getByText('ana.souza@exemplo.local')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Criar tenant' }))
    expect(await screen.findByText('O slug globex já está em uso ou reservado.')).toBeInTheDocument()
    expect(body).toEqual({
      slug: 'globex',
      name: 'Globex S.A.',
      modules: ['demo'],
      owner: { email: 'ana.souza@exemplo.local' },
    })
  })
})

describe('tenant na plataforma', () => {
  it('suspende e reativa explicando o efeito', async () => {
    withSession(adminSession)
    stubCatalog()
    stubTenant()
    const calls: string[] = []
    server.use(
      http.post('/bff/api/authz/admin/v1/tenants/globex/suspend', () => {
        calls.push('suspend')
        return HttpResponse.json({ ...globex, status: 'SUSPENDED' })
      }),
    )
    renderAt('/platform/tenants/globex')
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/não concede nenhuma permissão/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }))
    await waitFor(() => expect(calls).toEqual(['suspend']))
  })

  it('reativar aparece para tenant suspenso', async () => {
    withSession(adminSession)
    stubCatalog()
    stubTenant({ ...globex, status: 'SUSPENDED' })
    renderAt('/platform/tenants/globex')
    expect(await screen.findByRole('button', { name: 'Reativar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suspender' })).not.toBeInTheDocument()
  })

  it('exclusão exige digitar o slug e avisa que é irreversível', async () => {
    withSession(adminSession)
    stubCatalog()
    stubTenant()
    let deleted = false
    server.use(
      http.delete('/bff/api/authz/admin/v1/tenants/globex', () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
      http.get('/bff/api/authz/admin/v1/tenants', () => HttpResponse.json(page([]))),
    )
    const { router } = renderAt('/platform/tenants/globex')
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/irreversível/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Excluir tenant' })).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Digite/), 'globex')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir tenant' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/platform/tenants'))
    expect(deleted).toBe(true)
  })

  it('contrata e cancela módulos; core é implícito e sem ação', async () => {
    withSession(adminSession)
    stubCatalog()
    stubTenant()
    const calls: string[] = []
    server.use(
      http.put('/bff/api/authz/admin/v1/tenants/globex/modules/faturamento', () => {
        calls.push('put faturamento')
        return new HttpResponse(null, { status: 204 })
      }),
      http.delete('/bff/api/authz/admin/v1/tenants/globex/modules/demo', () => {
        calls.push('delete demo')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderAt('/platform/tenants/globex')
    const core = (await screen.findByText('implícito')).closest('tr') as HTMLElement
    expect(within(core).queryByRole('button')).not.toBeInTheDocument()

    await userEvent.selectOptions(await screen.findByLabelText('Contratar módulo'), 'faturamento')
    await userEvent.click(screen.getByRole('button', { name: 'Contratar' }))
    await waitFor(() => expect(calls).toContain('put faturamento'))

    const demo = screen.getByText('demo').closest('tr') as HTMLElement
    await userEvent.click(within(demo).getByRole('button', { name: 'Cancelar' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/deixam de valer/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar módulo' }))
    await waitFor(() => expect(calls).toContain('delete demo'))
  })
})

describe('auditoria da plataforma', () => {
  it('leva os filtros para a URL e converte o slug no tenantId', async () => {
    withSession(adminSession)
    stubTenant()
    let search = new URLSearchParams()
    server.use(
      http.get('/bff/api/authz/admin/v1/audit-events', ({ request }) => {
        search = new URL(request.url).searchParams
        return HttpResponse.json(
          page([
            {
              id: 'e1',
              occurredAt: '2026-10-12T10:00:00Z',
              type: 'TENANT_SUSPENDED',
              outcome: 'SUCCESS',
              tenantId: globex.id,
              details: { slug: 'globex' },
            },
          ]),
        )
      }),
    )
    const { router } = renderAt('/platform/audit?type=TENANT_SUSPENDED')
    expect(await screen.findByRole('button', { name: 'Tenant suspenso' })).toBeInTheDocument()
    expect(search.get('type')).toBe('TENANT_SUSPENDED')

    await userEvent.type(screen.getByLabelText('Tenant (slug)'), 'globex')
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }))
    await waitFor(() => expect(router.state.location.search).toContain('tenant=globex'))
    await waitFor(() => expect(search.get('tenantId')).toBe(globex.id))

    await userEvent.click(screen.getByRole('button', { name: 'Tenant suspenso' }))
    const panel = screen.getByRole('dialog')
    expect(within(panel).getByText(/"slug": "globex"/)).toBeInTheDocument()
  })
})
