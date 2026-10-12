import { useQuery } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/errors'
import { type Page, request } from '@/lib/api/client'
import { formatDateTime } from '@/lib/format'
import { hasPermission } from '@/lib/session'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'

import { ConfirmDialog } from './confirm-dialog'
import { DataTable } from './data-table'
import { applyApiErrors } from './api-form'
import { FormField } from './form-field'
import { useListParams } from './use-list-params'

interface Row {
  id: string
  email: string
}

function Location() {
  const location = useLocation()
  return <output aria-label="url">{location.pathname + location.search}</output>
}

function Users() {
  const params = useListParams()
  const query = useQuery({
    queryKey: ['users', params.query],
    queryFn: async () =>
      (
        await request<Page<Row>>(
          'get',
          `/bff/api/idp/users?${new URLSearchParams(params.query as Record<string, string>)}`,
        )
      ).data,
  })
  return (
    <>
      <DataTable
        caption="Usuários"
        columns={[{ key: 'email', header: 'E-mail', cell: (row: Row) => row.email, sortBy: 'email' }]}
        query={query}
        params={params}
        rowKey={(row) => row.id}
        empty={{ title: 'Nenhum usuário' }}
        search={{ param: 'email', label: 'E-mail' }}
      />
      <Location />
    </>
  )
}

describe('DataTable', () => {
  it('sincroniza busca, página e ordenação com a URL e consulta a API com elas', async () => {
    const calls: string[] = []
    server.use(
      http.get('/bff/api/idp/users', ({ request: call }) => {
        calls.push(new URL(call.url).search)
        return HttpResponse.json({
          content: [{ id: '1', email: 'ana@exemplo.com' }],
          page: 0,
          size: 20,
          totalElements: 41,
          totalPages: 3,
        })
      }),
    )
    renderWithProviders(<Users />, '/users?email=ana')

    expect(await screen.findByText('ana@exemplo.com')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana')
    expect(calls.at(-1)).toContain('email=ana')

    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await waitFor(() => expect(screen.getByLabelText('url')).toHaveTextContent('page=1'))

    await userEvent.clear(screen.getByLabelText('E-mail'))
    await userEvent.type(screen.getByLabelText('E-mail'), 'bruno')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(screen.getByLabelText('url')).toHaveTextContent('/users?email=bruno'))
    expect(screen.getByLabelText('url')).not.toHaveTextContent('page=')

    await userEvent.click(screen.getByRole('button', { name: /E-mail/ }))
    await waitFor(() => expect(screen.getByLabelText('url')).toHaveTextContent('sort=email%2Casc'))
    expect(calls.at(-1)).toContain('sort=email%2Casc')
  })

  it('mostra o estado vazio e o de erro com "tentar de novo"', async () => {
    server.use(
      http.get('/bff/api/idp/users', () =>
        HttpResponse.json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      ),
    )
    renderWithProviders(<Users />, '/users')
    expect(await screen.findByText('Nenhum usuário')).toBeInTheDocument()

    server.use(
      http.get('/bff/api/idp/users', () =>
        HttpResponse.json(
          { title: 'Falhou', status: 500 },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderWithProviders(<Users />, '/users?email=x')
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  function Harness({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = useState(true)
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Excluir tenant"
        description="Os membros perdem o acesso."
        confirmLabel="Excluir"
        requireText="acme"
        onConfirm={onConfirm}
      />
    )
  }

  it('só habilita a confirmação forte depois de digitar o identificador exato', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(<Harness onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: 'Excluir' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Digite/), 'acm')
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Digite/), 'e')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancela e fecha', async () => {
    renderWithProviders(<Harness onConfirm={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Excluir tenant')).not.toBeInTheDocument()
  })
})

describe('FormField e erros da API', () => {
  function Form({ error }: { error: unknown }) {
    const form = useForm({ defaultValues: { name: '', slug: '' } })
    return (
      <form>
        <FormField
          control={form.control}
          name="name"
          label="Nome"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <button type="button" onClick={() => applyApiErrors(form, error)}>
          Aplicar
        </button>
      </form>
    )
  }

  it('mostra no campo o erro de validação da API', async () => {
    const error = new ApiError(400, { errors: [{ field: 'name', message: 'não deve estar em branco' }] })
    renderWithProviders(<Form error={error} />)
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('não deve estar em branco')
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('utilitários', () => {
  it('permissão de escrita inclui a de leitura', () => {
    expect(hasPermission(['core.members:write'], 'core.members:read')).toBe(true)
    expect(hasPermission(['core.members:read'], 'core.members:write')).toBe(false)
    expect(hasPermission([], 'core.audit:read')).toBe(false)
  })

  it('formata datas como dd/MM/yyyy HH:mm', () => {
    expect(formatDateTime('2026-10-12T13:05:00')).toBe('12/10/2026 13:05')
    expect(formatDateTime(null)).toBe('—')
  })
})
