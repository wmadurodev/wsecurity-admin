import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { server } from '@/test/server'

import { authz, buildUrl, idp, onUnauthorized } from './client'
import { ApiError } from './errors'

describe('cliente HTTP do BFF', () => {
  it('monta a URL do proxy com variáveis codificadas e a query', () => {
    expect(buildUrl('idp', '/users/{id}', { path: { id: 'a/b c' } })).toBe('/bff/api/idp/users/a%2Fb%20c')
    expect(buildUrl('authz', '/admin/v1/tenants', { query: { page: 0, size: 20, status: undefined, q: '' } })).toBe(
      '/bff/api/authz/admin/v1/tenants?page=0&size=20',
    )
    expect(() => buildUrl('idp', '/users/{id}')).toThrow('Variável de caminho ausente: id')
  })

  it('envia o CSRF e o If-Match nas escritas e devolve ETag e Location', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123'
    let received: Headers | undefined
    let body: unknown
    server.use(
      http.patch('/bff/api/authz/v1/tenants/acme', async ({ request }) => {
        received = request.headers
        body = await request.json()
        return HttpResponse.json(
          { slug: 'acme' },
          { headers: { ETag: '"4"', Location: '/bff/api/authz/v1/tenants/acme' } },
        )
      }),
    )

    const response = await authz.patch('/v1/tenants/{tenant}', {
      path: { tenant: 'acme' },
      body: { name: 'Acme' },
      ifMatch: '"3"',
      contentType: 'application/merge-patch+json',
    })

    expect(received?.get('X-XSRF-TOKEN')).toBe('csrf-123')
    expect(received?.get('If-Match')).toBe('"3"')
    expect(received?.get('Content-Type')).toBe('application/merge-patch+json')
    expect(body).toEqual({ name: 'Acme' })
    expect(response).toMatchObject({ status: 200, etag: '"4"', location: '/bff/api/authz/v1/tenants/acme' })
  })

  it('não envia CSRF em GET', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123'
    let csrf: string | null = 'x'
    server.use(
      http.get('/bff/api/idp/scopes', ({ request }) => {
        csrf = request.headers.get('X-XSRF-TOKEN')
        return HttpResponse.json([])
      }),
    )
    await idp.get('/scopes')
    expect(csrf).toBeNull()
  })

  it('converte erros de validação, violações e traceId em ApiError', async () => {
    server.use(
      http.post('/bff/api/idp/scopes', () =>
        HttpResponse.json(
          {
            type: 'https://wsecurity.dev/problems/validation-failed',
            title: 'Requisição inválida',
            status: 400,
            traceId: 'abc',
            errors: [{ field: 'name', message: 'não deve estar em branco' }],
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
      http.post('/bff/api/idp/clients', () =>
        HttpResponse.json(
          { status: 422, title: 'Configuração de cliente inválida', violations: ['scope-unknown:x'] },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )

    const validation = await idp.post('/scopes', { body: { name: '' } as never }).catch((error: unknown) => error)
    const rules = await idp.post('/clients', { body: {} as never }).catch((error: unknown) => error)

    expect(validation).toBeInstanceOf(ApiError)
    expect(validation).toMatchObject({ status: 400, traceId: 'abc', fieldErrors: { name: 'não deve estar em branco' } })
    expect(rules).toMatchObject({ status: 422, violations: ['scope-unknown:x'] })
  })

  it('trata 409 e 412 como conflito e aceita respostas sem corpo', async () => {
    server.use(
      http.delete('/bff/api/idp/users/u1', () => new HttpResponse(null, { status: 204 })),
      http.put('/bff/api/authz/admin/v1/roles/r1', () => new HttpResponse('falhou', { status: 412 })),
    )
    await expect(idp.delete('/users/{id}', { path: { id: 'u1' } })).resolves.toMatchObject({
      status: 204,
      data: undefined,
    })
    const conflict = (await authz.put('/admin/v1/roles/{code}', { path: { code: 'r1' }, body: {} as never }).then(
      () => undefined,
      (error: unknown) => error,
    )) as ApiError
    expect(conflict.isConflict).toBe(true)
  })

  it('avisa os interessados a cada 401', async () => {
    const listener = vi.fn()
    const stop = onUnauthorized(listener)
    server.use(http.get('/bff/api/idp/keys', () => new HttpResponse(null, { status: 401 })))
    await expect(idp.get('/keys')).rejects.toMatchObject({ status: 401 })
    stop()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
