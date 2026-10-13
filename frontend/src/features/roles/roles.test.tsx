import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { adminSession } from '@/test/fixtures'
import { renderAt, renderWithProviders, withSession } from '@/test/render'
import { server } from '@/test/server'

import { type Grant, type MatrixFeature, PermissionMatrix } from './components/PermissionMatrix'

const features: MatrixFeature[] = [
  {
    code: 'faturamento.notas',
    name: 'Notas',
    module: 'faturamento',
    moduleName: 'Faturamento',
    category: 'Fiscal',
    enabled: true,
  },
  {
    code: 'faturamento.boletos',
    name: 'Boletos',
    module: 'faturamento',
    moduleName: 'Faturamento',
    category: 'Cobrança',
    enabled: true,
  },
  {
    code: 'faturamento.antigo',
    name: 'Antigo',
    module: 'faturamento',
    moduleName: 'Faturamento',
    category: 'Fiscal',
    enabled: false,
  },
  { code: 'core.audit', name: 'Auditoria', module: 'core', moduleName: 'Núcleo', enabled: true },
]

function Matrix({
  canGrant,
  onGrants,
}: {
  canGrant?: (feature: string, access: 'READ' | 'WRITE') => boolean
  onGrants?: (grants: Grant[]) => void
}) {
  const [grants, setGrants] = useState<Grant[]>([{ feature: 'core.audit', access: 'READ' }])
  return (
    <PermissionMatrix
      features={features}
      grants={grants}
      canGrant={canGrant}
      deniedHint="Você não tem esta permissão."
      onChange={(next) => {
        setGrants(next)
        onGrants?.(next)
      }}
    />
  )
}

describe('PermissionMatrix', () => {
  it('agrupa por módulo e categoria e conta as concessões', () => {
    renderWithProviders(<Matrix />)
    const faturamento = screen.getByRole('region', { name: /Faturamento/ })
    expect(within(faturamento).getByText('Fiscal')).toBeInTheDocument()
    expect(within(faturamento).getByText('Cobrança')).toBeInTheDocument()
    expect(within(faturamento).getByLabelText('0 de 3 com acesso')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: /Núcleo/ })).getByLabelText('1 de 1 com acesso'),
    ).toBeInTheDocument()
  })

  it('escolhe o nível pelo clique e pelas setas do teclado e devolve as concessões', async () => {
    let output: Grant[] = []
    renderWithProviders(<Matrix onGrants={(grants) => (output = grants)} />)
    const notas = screen.getByRole('radiogroup', { name: 'Acesso a Notas' })
    await userEvent.click(within(notas).getByRole('radio', { name: 'Leitura' }))
    expect(output).toContainEqual({ feature: 'faturamento.notas', access: 'READ' })
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(within(notas).getByRole('radio', { name: 'Escrita' })).toBeChecked())
    expect(output).toContainEqual({ feature: 'faturamento.notas', access: 'WRITE' })
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Acesso a Auditoria' })).getByRole('radio', { name: 'Sem acesso' }),
    )
    expect(output.find((grant) => grant.feature === 'core.audit')).toBeUndefined()
  })

  it('desabilita as opções negadas, com dica, e as funcionalidades desabilitadas', () => {
    renderWithProviders(
      <Matrix canGrant={(feature, access) => !(feature === 'faturamento.boletos' && access === 'WRITE')} />,
    )
    const boletos = screen.getByRole('radiogroup', { name: 'Acesso a Boletos' })
    expect(within(boletos).getByRole('radio', { name: 'Escrita' })).toBeDisabled()
    expect(within(boletos).getByRole('radio', { name: 'Leitura' })).toBeEnabled()
    expect(boletos).toHaveAccessibleDescription('Você não tem esta permissão.')
    const antigo = screen.getByRole('radiogroup', { name: 'Acesso a Antigo' })
    expect(within(antigo).getByRole('radio', { name: 'Leitura' })).toBeDisabled()
    expect(screen.getByText('desabilitada')).toBeInTheDocument()
  })

  it('trava a linha cuja concessão atual o chamador não pode retirar', () => {
    renderWithProviders(<Matrix canGrant={(feature) => feature !== 'core.audit'} />)
    const auditoria = screen.getByRole('radiogroup', { name: 'Acesso a Auditoria' })
    expect(within(auditoria).getByRole('radio', { name: 'Leitura' })).toBeChecked()
    expect(within(auditoria).getByRole('radio', { name: 'Sem acesso' })).toBeDisabled()
    expect(within(auditoria).getByRole('radio', { name: 'Escrita' })).toBeDisabled()
  })

  it('filtra por texto', async () => {
    renderWithProviders(<Matrix />)
    await userEvent.type(screen.getByLabelText('Filtrar funcionalidades'), 'boleto')
    expect(screen.getByRole('radiogroup', { name: 'Acesso a Boletos' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Acesso a Notas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Núcleo/ })).not.toBeInTheDocument()
  })
})

function stubCatalog() {
  server.use(
    http.get('/bff/api/authz/admin/v1/modules', () =>
      HttpResponse.json({
        content: [
          { code: 'core', name: 'Núcleo', enabled: true, system: true },
          { code: 'faturamento', name: 'Faturamento', enabled: true, system: false },
        ],
        page: 0,
        size: 100,
        totalElements: 2,
        totalPages: 1,
      }),
    ),
    http.get('/bff/api/authz/admin/v1/modules/core/features', () =>
      HttpResponse.json([{ code: 'core.audit', module: 'core', name: 'Auditoria', enabled: true, system: true }]),
    ),
    http.get('/bff/api/authz/admin/v1/modules/faturamento/features', () =>
      HttpResponse.json([
        { code: 'faturamento.notas', module: 'faturamento', name: 'Notas', category: 'Fiscal', enabled: true },
      ]),
    ),
  )
}

describe('papéis globais', () => {
  it('papel de sistema é só leitura', async () => {
    withSession(adminSession)
    stubCatalog()
    server.use(
      http.get('/bff/api/authz/admin/v1/roles/viewer', () =>
        HttpResponse.json({
          code: 'viewer',
          name: 'Leitor',
          scope: 'SYSTEM',
          grants: [{ feature: 'core.audit', access: 'READ' }],
        }),
      ),
    )
    renderAt('/platform/roles/viewer')
    expect(await screen.findByText('sistema (só leitura)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir papel' })).not.toBeInTheDocument()
    const audit = await screen.findByRole('radiogroup', { name: 'Acesso a Auditoria' })
    expect(within(audit).getByRole('radio', { name: 'Leitura' })).toBeChecked()
    expect(within(audit).getByRole('radio', { name: 'Escrita' })).toBeDisabled()
  })

  it('cria um papel global com as concessões da matriz', async () => {
    withSession(adminSession)
    stubCatalog()
    let body: Record<string, unknown> = {}
    server.use(
      http.post('/bff/api/authz/admin/v1/roles', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ code: 'auditor', name: 'Auditor', scope: 'GLOBAL', grants: [] }, { status: 201 })
      }),
      http.get('/bff/api/authz/admin/v1/roles/auditor', () =>
        HttpResponse.json({ code: 'auditor', name: 'Auditor', scope: 'GLOBAL', grants: [] }),
      ),
    )
    const { router } = renderAt('/platform/roles/new')
    await userEvent.type(await screen.findByLabelText('Código'), 'auditor')
    await userEvent.type(screen.getByLabelText('Nome'), 'Auditor')
    await userEvent.click(
      within(await screen.findByRole('radiogroup', { name: 'Acesso a Notas' })).getByRole('radio', { name: 'Leitura' }),
    )
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Acesso a Auditoria' })).getByRole('radio', { name: 'Leitura' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Criar papel' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/platform/roles/auditor'))
    expect(body).toMatchObject({
      code: 'auditor',
      name: 'Auditor',
      grants: expect.arrayContaining([
        { feature: 'faturamento.notas', access: 'READ' },
        { feature: 'core.audit', access: 'READ' },
      ]),
    })
  })

  it('a exclusão de papel atribuído mostra o erro da API', async () => {
    withSession(adminSession)
    stubCatalog()
    server.use(
      http.get('/bff/api/authz/admin/v1/roles/viewer2', () =>
        HttpResponse.json(
          { code: 'viewer2', name: 'Leitor 2', scope: 'GLOBAL', grants: [] },
          { headers: { ETag: '"1"' } },
        ),
      ),
      http.delete('/bff/api/authz/admin/v1/roles/viewer2', () =>
        HttpResponse.json(
          { status: 409, title: 'Papel em uso', detail: 'O papel está atribuído a membros.' },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderAt('/platform/roles/viewer2')
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir papel' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir papel' }))
    expect(await screen.findByText('Papel em uso')).toBeInTheDocument()
    expect(screen.getByText(/atribuído a membros/)).toBeInTheDocument()
  })
})

describe('catálogo', () => {
  it('módulo valida o código e funcionalidade compõe o código com o módulo', async () => {
    withSession(adminSession)
    stubCatalog()
    let feature: Record<string, unknown> = {}
    server.use(
      http.get('/bff/api/authz/admin/v1/modules/faturamento', () =>
        HttpResponse.json({ code: 'faturamento', name: 'Faturamento', enabled: true, system: false }),
      ),
      http.post('/bff/api/authz/admin/v1/modules/faturamento/features', async ({ request }) => {
        feature = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ code: 'faturamento.boletos' }, { status: 201 })
      }),
    )
    renderAt('/platform/modules')
    await userEvent.click(await screen.findByRole('button', { name: 'Novo módulo' }))
    const moduleDialog = screen.getByRole('dialog')
    await userEvent.type(within(moduleDialog).getByLabelText('Código'), 'Fatura Mento')
    await userEvent.type(within(moduleDialog).getByLabelText('Nome'), 'Faturamento')
    await userEvent.click(within(moduleDialog).getByRole('button', { name: 'Criar módulo' }))
    expect(await within(moduleDialog).findByText(/minúsculas, números e hífen/)).toBeInTheDocument()

    renderAt('/platform/modules/faturamento')
    await userEvent.click((await screen.findAllByRole('button', { name: 'Nova funcionalidade' }))[0] as HTMLElement)
    const dialog = screen.getAllByRole('dialog').at(-1) as HTMLElement
    await userEvent.type(within(dialog).getByLabelText('Código'), 'boletos')
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Boletos')
    await userEvent.type(within(dialog).getByLabelText('Categoria'), 'Cobrança')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar funcionalidade' }))
    await waitFor(() =>
      expect(feature).toMatchObject({ code: 'faturamento.boletos', name: 'Boletos', category: 'Cobrança' }),
    )
  })

  it('funcionalidades de sistema aparecem sem ações', async () => {
    withSession(adminSession)
    stubCatalog()
    server.use(
      http.get('/bff/api/authz/admin/v1/modules/core', () =>
        HttpResponse.json({ code: 'core', name: 'Núcleo', enabled: true, system: true }),
      ),
    )
    renderAt('/platform/modules/core')
    expect(await screen.findByText('core.audit')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir módulo' })).not.toBeInTheDocument()
  })
})
