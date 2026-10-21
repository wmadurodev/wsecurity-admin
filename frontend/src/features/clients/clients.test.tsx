import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { adminSession } from '@/test/fixtures'
import { renderAt, withSession } from '@/test/render'
import { server } from '@/test/server'

import type { Client, Scope } from './api'
import {
  clientSchema,
  isAllowedRedirectUri,
  NEW_CLIENT,
  requestFromValues,
  valuesFromClient,
} from './client-form-model'
import { describe as describeDuration, toMinutes } from './durations'

const SECRET = 'segredo-super-secreto-123'
const scopes: Scope[] = [
  { name: 'openid', standard: true, enabled: true, descriptionPt: 'Identidade' },
  { name: 'wsecurity.admin', standard: true, enabled: true, descriptionPt: 'Administração' },
  { name: 'pedidos.leitura', standard: false, enabled: true, descriptionPt: 'Ler pedidos' },
]
const client: Client = {
  clientId: 'loja-web',
  name: 'Loja Web',
  type: 'CONFIDENTIAL',
  enabled: true,
  authenticationMethods: ['client_secret_basic'],
  grantTypes: ['authorization_code', 'refresh_token'],
  redirectUris: ['https://loja.exemplo/callback'],
  postLogoutRedirectUris: [],
  scopes: ['openid'],
  firstParty: false,
  allowedAdminScope: false,
  revokeOnLogout: true,
  accessTokenTtl: 'PT5M',
  refreshTokenTtl: 'PT720H',
  refreshTokenIdleTtl: 'P7D',
  authorizationCodeTtl: 'PT5M',
  settings: { audiences: ['wsecurity-authorization'], outro: 'mantido' },
}

function stubScopes() {
  server.use(http.get('/bff/api/idp/scopes', () => HttpResponse.json(scopes)))
}

describe('regras do formulário de cliente', () => {
  const valid = { ...NEW_CLIENT, name: 'App', redirectUris: 'https://app.exemplo/cb' }
  const issues = (values: object) =>
    clientSchema.safeParse({ ...valid, ...values }).error?.issues.map((issue) => issue.message) ?? []

  it('cliente público não usa refresh token nem client credentials', () => {
    expect(issues({ type: 'PUBLIC', refreshToken: true })).toContain(
      'Cliente público não recebe refresh token (0001/DEC-11).',
    )
    expect(issues({ type: 'PUBLIC', refreshToken: false, clientCredentials: true })).toContain(
      'Cliente público não usa client credentials.',
    )
    expect(issues({ type: 'PUBLIC', refreshToken: false })).toEqual([])
  })

  it('exige coerência entre grants, URIs e escopos', () => {
    expect(issues({ authorizationCode: false, refreshToken: true, scopes: ['pedidos.leitura'] })).toContain(
      'Refresh token exige authorization code.',
    )
    expect(issues({ redirectUris: '' })).toContain('Informe pelo menos uma URI de retorno.')
    expect(issues({ redirectUris: 'http://app.exemplo/cb' })[0]).toMatch(/URI inválida/)
    expect(issues({ scopes: ['wsecurity.admin'] })).toContain(
      'Para usar wsecurity.admin, autorize explicitamente o escopo administrativo.',
    )
    expect(issues({ authenticationMethod: 'private_key_jwt', jwkSetUrl: 'http://x' })).toContain(
      'private_key_jwt exige a URL https do JWKS do cliente.',
    )
    expect(issues({ accessTokenMinutes: 90 })).toContain('Máximo de 60 minutos.')
  })

  it('URIs de retorno seguem a regra do IdP', () => {
    expect(isAllowedRedirectUri('https://app.exemplo/cb', 'CONFIDENTIAL')).toBe(true)
    expect(isAllowedRedirectUri('http://localhost:5174/cb', 'CONFIDENTIAL')).toBe(true)
    expect(isAllowedRedirectUri('http://app.exemplo/cb', 'CONFIDENTIAL')).toBe(false)
    expect(isAllowedRedirectUri('com.exemplo.app:/cb', 'PUBLIC')).toBe(true)
    expect(isAllowedRedirectUri('com.exemplo.app:/cb', 'CONFIDENTIAL')).toBe(false)
  })

  it('aceita http no endereço pelo qual o console está aberto (acesso pela rede, 0005/RF-REDE-08)', () => {
    const ip = '192.168.0.10'
    expect(isAllowedRedirectUri('http://192.168.0.10:5180/callback', 'PUBLIC', ip)).toBe(true)
    expect(isAllowedRedirectUri('http://192.168.0.10:5180/callback', 'PUBLIC', 'localhost')).toBe(false)
    expect(isAllowedRedirectUri('http://192.168.0.100/cb', 'PUBLIC', ip)).toBe(false)
    expect(isAllowedRedirectUri('http://10.0.0.5/cb', 'CONFIDENTIAL', ip)).toBe(false)
    expect(isAllowedRedirectUri('http://localhost:9200/cb', 'CONFIDENTIAL', ip)).toBe(true)
    expect(isAllowedRedirectUri('https://192.168.0.10/cb', 'CONFIDENTIAL', ip)).toBe(true)
    expect(isAllowedRedirectUri('com.exemplo.app:/cb', 'CONFIDENTIAL', ip)).toBe(false)
  })

  it('o formulário usa o host da página para o http', () => {
    vi.stubGlobal('location', { ...window.location, hostname: '192.168.0.10' })
    try {
      expect(issues({ redirectUris: 'http://192.168.0.10:5180/callback' })).toEqual([])
      expect(issues({ redirectUris: 'http://10.0.0.5/cb' })[0]).toMatch(
        /http só em localhost ou no endereço deste console/,
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('converte durações e preserva os outros settings na edição', () => {
    expect(toMinutes('PT720H')).toBe(43_200)
    expect(describeDuration('PT720H')).toBe('30 dias')
    const values = valuesFromClient(client)
    expect(values.refreshTokenDays).toBe(30)
    const request = requestFromValues({ ...values, audiences: '' }, client)
    expect(request.settings).toEqual({ outro: 'mantido' })
    expect(request.refreshTokenTtl).toBe('P30D')
    expect(requestFromValues({ ...values, type: 'PUBLIC', refreshToken: false }).authenticationMethods).toEqual([
      'none',
    ])
  })
})

describe('telas de clientes', () => {
  it('cliente público desabilita refresh token e client credentials', async () => {
    withSession(adminSession)
    stubScopes()
    renderAt('/platform/clients/new')
    const refresh = await screen.findByRole('checkbox', { name: 'Refresh token' })
    expect(refresh).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: /Público/ }))
    await waitFor(() => expect(refresh).not.toBeChecked())
    expect(refresh).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Client credentials/ })).toBeDisabled()
    expect(screen.queryByLabelText('Autenticação do cliente')).not.toBeInTheDocument()
  })

  it('wsecurity.admin só com a autorização explícita, e com aviso', async () => {
    withSession(adminSession)
    stubScopes()
    renderAt('/platform/clients/new')
    const admin = await screen.findByRole('checkbox', { name: 'wsecurity.admin' })
    expect(admin).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /Autorizar o escopo administrativo/ }))
    expect(admin).toBeEnabled()
    expect(screen.getByText('Escopo com poder total')).toBeInTheDocument()
  })

  it('mostra o segredo uma vez, não fecha com Esc e não guarda no cache', async () => {
    withSession(adminSession)
    stubScopes()
    server.use(
      http.post('/bff/api/idp/clients', () => HttpResponse.json({ client, clientSecret: SECRET }, { status: 201 })),
      http.get('/bff/api/idp/clients/loja-web', () => HttpResponse.json(client)),
    )
    const { router, queryClient } = renderAt('/platform/clients/new')
    await userEvent.type(await screen.findByLabelText('Nome'), 'Loja Web')
    await userEvent.type(screen.getByLabelText('URIs de retorno'), 'https://loja.exemplo/callback')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(SECRET)).toBeInTheDocument()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const caches = JSON.stringify([
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state.data),
    ])
    expect(caches).not.toContain(SECRET)
    expect(router.state.location.pathname + router.state.location.search).not.toContain(SECRET)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Já guardei' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/platform/clients/loja-web'))
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument()
  })

  it('mostra as violações do IdP na criação', async () => {
    withSession(adminSession)
    stubScopes()
    server.use(
      http.post('/bff/api/idp/clients', () =>
        HttpResponse.json(
          { status: 422, title: 'Configuração de cliente inválida', violations: ['scope-unknown:nao.existe'] },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderAt('/platform/clients/new')
    await userEvent.type(await screen.findByLabelText('Nome'), 'X')
    await userEvent.type(screen.getByLabelText('URIs de retorno'), 'https://x.exemplo/cb')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }))
    expect(await screen.findByText('Escopo desconhecido: nao.existe')).toBeInTheDocument()
  })

  it('gera um segundo segredo com aviso de transição e revoga um segredo com confirmação', async () => {
    withSession(adminSession)
    stubScopes()
    let revoked = ''
    server.use(
      http.get('/bff/api/idp/clients/loja-web', () => HttpResponse.json(client)),
      http.get('/bff/api/idp/clients/loja-web/secrets', () =>
        HttpResponse.json([{ id: 's1', createdAt: '2026-10-01T10:00:00Z', expiresAt: null, active: true }]),
      ),
      http.post('/bff/api/idp/clients/loja-web/secrets', () =>
        HttpResponse.json({ clientSecret: SECRET, previousSecretsExpireAt: '2026-10-13T10:00:00Z' }),
      ),
      http.delete('/bff/api/idp/clients/loja-web/secrets/s1', ({ params }) => {
        revoked = String(params.secretId ?? 's1')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderAt('/platform/clients/loja-web?aba=segredos')
    await userEvent.click(await screen.findByRole('button', { name: 'Gerar novo segredo' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Gerar segredo' }))
    const secretDialog = await screen.findByRole('dialog', { name: /Segredo do cliente/ })
    expect(within(secretDialog).getByText(SECRET)).toBeInTheDocument()
    expect(within(secretDialog).getByText(/período de transição/)).toBeInTheDocument()
    await userEvent.click(within(secretDialog).getByRole('button', { name: 'Já guardei' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Revogar' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revogar' }))
    await waitFor(() => expect(revoked).toBe('s1'))
  })

  it('desativa o cliente com o aviso de revogação dos tokens', async () => {
    withSession(adminSession)
    stubScopes()
    let disabled = false
    server.use(
      http.get('/bff/api/idp/clients/loja-web', () => HttpResponse.json(client)),
      http.post('/bff/api/idp/clients/loja-web/disable', () => {
        disabled = true
        return HttpResponse.json({ ...client, enabled: false })
      }),
    )
    renderAt('/platform/clients/loja-web')
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/tokens já emitidos para ele são revogados/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }))
    await waitFor(() => expect(disabled).toBe(true))
  })
})

describe('escopos e chaves', () => {
  it('escopos padrão aparecem marcados e sem ações', async () => {
    withSession(adminSession)
    stubScopes()
    renderAt('/platform/scopes')
    const openid = (await screen.findByText('openid')).closest('tr') as HTMLElement
    expect(within(openid).getByText('padrão')).toBeInTheDocument()
    expect(within(openid).queryByRole('button')).not.toBeInTheDocument()
    const custom = screen.getByText('pedidos.leitura').closest('tr') as HTMLElement
    expect(within(custom).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(within(custom).getByRole('button', { name: 'Desativar' })).toBeInTheDocument()
  })

  it('girar exige digitar "girar" e chama o módulo certo', async () => {
    withSession(adminSession)
    const rotated: string[] = []
    const keys = [{ kid: 'k1', algorithm: 'RS256', status: 'ACTIVE', createdAt: '2026-10-01T10:00:00Z' }]
    server.use(
      http.get('/bff/api/idp/keys', () => HttpResponse.json(keys)),
      http.get('/bff/api/authz/admin/v1/keys', () => HttpResponse.json([{ ...keys[0], kid: 'a1' }])),
      http.post('/bff/api/authz/admin/v1/keys/rotate', () => {
        rotated.push('authz')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderAt('/platform/keys')
    expect(await screen.findByText('k1')).toBeInTheDocument()
    const section = (await screen.findByText('a1')).closest('section') as HTMLElement
    await userEvent.click(within(section).getByRole('button', { name: 'Girar agora' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Girar agora' })
    expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Digite/), 'girar')
    await userEvent.click(confirm)
    await waitFor(() => expect(rotated).toEqual(['authz']))
  })
})
