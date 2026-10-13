import { useQuery } from '@tanstack/react-query'
import { Check, UserPlus } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'

import { type Column, DataTable } from '@/components/data-table'
import { DateTime } from '@/components/date-time'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useListParams } from '@/components/use-list-params'

import { listUsers, type User, userKeys } from './api'
import { CreateUserDialog } from './CreateUserDialog'
import { STATUS_OPTIONS } from './labels'

const columns: Column<User>[] = [
  {
    key: 'name',
    header: 'Nome',
    sortBy: 'name',
    cell: (user) => (
      <Link to={`/platform/users/${user.id}`} className="font-medium underline-offset-4 hover:underline">
        {user.name ?? '—'}
      </Link>
    ),
  },
  { key: 'email', header: 'E-mail', sortBy: 'email', cell: (user) => user.email },
  {
    key: 'status',
    header: 'Status',
    sortBy: 'status',
    cell: (user) => (
      <span className="flex flex-wrap gap-1">
        <StatusBadge status={user.status} />
        {user.locked && <StatusBadge status="LOCKED" />}
      </span>
    ),
  },
  {
    key: 'admin',
    header: 'Administrador',
    cell: (user) =>
      user.wsecurityAdmin ? (
        <span className="inline-flex items-center gap-1">
          <Check className="size-4" aria-hidden="true" />
          sim
        </span>
      ) : (
        <span className="text-muted-foreground">não</span>
      ),
  },
  {
    key: 'lastLogin',
    header: 'Último acesso',
    sortBy: 'lastLoginAt',
    cell: (user) => <DateTime value={user.lastLoginAt} />,
  },
]

/** Usuários do IdP (RF-USR-01): busca por e-mail e nome, filtro de status e criação. */
export function UsersPage() {
  const params = useListParams({ sort: 'createdAt,desc' })
  const query = useQuery({ queryKey: userKeys.list(params.query), queryFn: () => listUsers(params.query) })
  const [creating, setCreating] = useState(false)
  const nameId = useId()
  const statusId = useId()
  const [name, setName] = useState(params.get('name') ?? '')

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Contas do IdP."
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus aria-hidden="true" />
            Novo usuário
          </Button>
        }
      />
      <DataTable
        caption="Usuários do IdP"
        columns={columns}
        query={query}
        params={params}
        rowKey={(user) => user.id ?? user.email ?? ''}
        search={{ param: 'email', label: 'E-mail', placeholder: 'contém…' }}
        filters={
          <>
            <form
              className="flex flex-col gap-1.5"
              onSubmit={(event) => {
                event.preventDefault()
                params.set({ name: name.trim() || undefined })
              }}
            >
              <label htmlFor={nameId} className="text-sm font-medium">
                Nome
              </label>
              <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} className="w-48" />
            </form>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={statusId} className="text-sm font-medium">
                Status
              </label>
              <Select
                id={statusId}
                value={params.get('status') ?? ''}
                onChange={(event) => params.set({ status: event.target.value || undefined })}
                className="w-48"
              >
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </>
        }
        empty={{
          title: 'Nenhum usuário encontrado',
          description: 'Ajuste a busca ou crie um usuário.',
          action: <Button onClick={() => setCreating(true)}>Novo usuário</Button>,
        }}
      />
      <CreateUserDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
