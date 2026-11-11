import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { adminSession } from '@/test/fixtures'
import { renderAt, withSession } from '@/test/render'
import { server } from '@/test/server'

import { isSystemUrl, type Module } from './api'

const MODULE: Module = {
  code: 'financas',
  name: 'Finanças',
  description: 'Contas da empresa',
  enabled: true,
  system: false,
  url: 'http://localhost:5180',
  version: 3,
}

function stubModule(module: Module) {
  server.use(
    http.get('/bff/api/authz/admin/v1/modules/financas', () => HttpResponse.json(module)),
    http.get('/bff/api/authz/admin/v1/modules/financas/features', () => HttpResponse.json([])),
  )
}

describe('endereço do sistema do módulo (fase 0014)', () => {
  it('aceita só http(s) completo, sem credenciais nem fragmento', () => {
    expect(isSystemUrl('http://localhost:5180')).toBe(true)
    expect(isSystemUrl('https://sistema.exemplo.com/app?x=1')).toBe(true)
    expect(isSystemUrl('javascript:alert(1)')).toBe(false)
    expect(isSystemUrl('ftp://x.test')).toBe(false)
    expect(isSystemUrl('/relativa')).toBe(false)
    expect(isSystemUrl('http://u:p@x.test')).toBe(false)
    expect(isSystemUrl('https://x.test/#a')).toBe(false)
    expect(isSystemUrl(' http://x.test')).toBe(false)
  })

  it('o detalhe mostra o endereço como link externo', async () => {
    withSession(adminSession)
    stubModule(MODULE)
    renderAt('/platform/modules/financas')

    const link = await screen.findByRole('link', { name: 'http://localhost:5180' })
    expect(link).toHaveAttribute('href', 'http://localhost:5180')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('editar envia o endereço; limpar o campo envia vazio para remover', async () => {
    withSession(adminSession)
    stubModule(MODULE)
    const bodies: unknown[] = []
    server.use(
      http.patch('/bff/api/authz/admin/v1/modules/financas', async ({ request }) => {
        const body = await request.json()
        bodies.push(body)
        return HttpResponse.json({ ...MODULE, url: (body as { url?: string }).url || undefined })
      }),
    )
    renderAt('/platform/modules/financas')

    await userEvent.click(await screen.findByRole('button', { name: 'Editar módulo' }))
    let dialog = screen.getByRole('dialog')
    const field = within(dialog).getByLabelText('Endereço do sistema')
    expect(field).toHaveValue('http://localhost:5180')
    await userEvent.clear(field)
    await userEvent.type(field, 'https://financas.exemplo.com')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toMatchObject({ url: 'https://financas.exemplo.com' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Editar módulo' }))
    dialog = screen.getByRole('dialog')
    await userEvent.clear(within(dialog).getByLabelText('Endereço do sistema'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1]).toMatchObject({ url: '' })
  })

  it('endereço inválido mostra o erro no campo, sem chamar a API', async () => {
    withSession(adminSession)
    stubModule(MODULE)
    let called = false
    server.use(
      http.patch('/bff/api/authz/admin/v1/modules/financas', () => {
        called = true
        return HttpResponse.json(MODULE)
      }),
    )
    renderAt('/platform/modules/financas')

    await userEvent.click(await screen.findByRole('button', { name: 'Editar módulo' }))
    const dialog = screen.getByRole('dialog')
    const field = within(dialog).getByLabelText('Endereço do sistema')
    await userEvent.clear(field)
    await userEvent.type(field, 'javascript:alert(1)')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    expect(await within(dialog).findByText(/Use um endereço http ou https completo/)).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it('erro do servidor no campo url aparece no campo', async () => {
    withSession(adminSession)
    stubModule({ ...MODULE, url: undefined })
    server.use(
      http.patch('/bff/api/authz/admin/v1/modules/financas', () =>
        HttpResponse.json(
          {
            type: 'https://wsecurity.dev/problems/validation',
            title: 'Dados inválidos',
            status: 400,
            errors: [{ field: 'url', message: 'Endereço recusado pelo servidor' }],
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderAt('/platform/modules/financas')

    await userEvent.click(await screen.findByRole('button', { name: 'Editar módulo' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Endereço do sistema'), 'https://ok.exemplo.com')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    expect(await within(dialog).findByText('Endereço recusado pelo servidor')).toBeInTheDocument()
  })
})
