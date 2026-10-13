import { useQuery } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useParams } from 'react-router'

import { type Column, DataTable } from '@/components/data-table'
import { DateTime } from '@/components/date-time'
import { PageHeader } from '@/components/page-header'
import { PermissionGate } from '@/components/permission-gate'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useListParams } from '@/components/use-list-params'
import { type User, useUserIdentities } from '@/features/users'
import { useSession } from '@/lib/session-context'

import { AddMemberDialog } from './AddMemberDialog'
import { listMembers, type Member, tenantAreaKeys } from './api'
import { isExpired, MEMBER_STATUS_OPTIONS, SUBJECT_TYPE_OPTIONS, subjectTypeLabel } from './labels'
import { MemberIdentity } from './MemberIdentity'

function columns(slug: string, identities: Map<string, User>): Column<Member>[] {
  return [
    {
      key: 'subject',
      header: 'Identificação',
      sortBy: 'subject',
      cell: (member) => {
        const subject = member.subject ?? ''
        return (
          <span className="flex items-center gap-2">
            <MemberIdentity subject={subject} user={identities.get(subject)} />
            <Link
              to={`/t/${encodeURIComponent(slug)}/members/${encodeURIComponent(subject)}`}
              className="text-sm underline underline-offset-4"
              aria-label={`Abrir o membro ${identities.get(subject)?.email ?? subject}`}
            >
              Abrir
            </Link>
          </span>
        )
      },
    },
    { key: 'type', header: 'Tipo', cell: (member) => subjectTypeLabel(member.subjectType) },
    {
      key: 'roles',
      header: 'Papéis',
      cell: (member) => (
        <span className="flex flex-wrap gap-1">
          {(member.roles ?? []).map((role) => (
            <Badge key={role} variant="secondary">
              {role}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortBy: 'status',
      cell: (member) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={member.status} />
          {isExpired(member) && <StatusBadge status="EXPIRED" />}
        </span>
      ),
    },
    { key: 'expiresAt', header: 'Expiração', cell: (member) => <DateTime value={member.expiresAt} /> },
  ]
}

/** Membros do tenant (RF-MEM-01), com filtros de status, papel e tipo, e a identificação conforme Q-03. */
export function MembersPage() {
  const { slug = '' } = useParams()
  const { isPlatformAdmin } = useSession()
  const params = useListParams({ sort: 'createdAt,desc' })
  const query = useQuery({
    queryKey: tenantAreaKeys.members(slug, params.query),
    queryFn: () => listMembers(slug, params.query),
  })
  const users = (query.data?.content ?? [])
    .filter((member) => member.subjectType === 'USER' && member.subject)
    .map((member) => member.subject as string)
  const identities = useUserIdentities(users, isPlatformAdmin)
  const [adding, setAdding] = useState(false)
  const ids = { status: useId(), role: useId(), type: useId() }
  const [role, setRole] = useState(params.get('role') ?? '')

  const addButton = (
    <PermissionGate tenant={slug} permission="core.members:write">
      <Button onClick={() => setAdding(true)}>
        <UserPlus aria-hidden="true" />
        Adicionar membro
      </Button>
    </PermissionGate>
  )
  return (
    <>
      <PageHeader
        title="Membros"
        description="Usuários e contas de serviço vinculados ao tenant."
        actions={addButton}
      />
      <DataTable
        caption="Membros do tenant"
        columns={columns(slug, identities)}
        query={query}
        params={params}
        rowKey={(member) => member.subject ?? ''}
        filters={
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.status} className="text-sm font-medium">
                Status
              </label>
              <Select
                id={ids.status}
                value={params.get('status') ?? ''}
                onChange={(event) => params.set({ status: event.target.value || undefined })}
                className="w-40"
              >
                <option value="">Todos</option>
                {MEMBER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <form
              className="flex flex-col gap-1.5"
              onSubmit={(event) => {
                event.preventDefault()
                params.set({ role: role.trim() || undefined })
              }}
            >
              <label htmlFor={ids.role} className="text-sm font-medium">
                Papel
              </label>
              <Input
                id={ids.role}
                value={role}
                placeholder="código, ex.: viewer"
                onChange={(event) => setRole(event.target.value)}
                className="w-44"
              />
            </form>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.type} className="text-sm font-medium">
                Tipo
              </label>
              <Select
                id={ids.type}
                value={params.get('subjectType') ?? ''}
                onChange={(event) => params.set({ subjectType: event.target.value || undefined })}
                className="w-44"
              >
                <option value="">Todos</option>
                {SUBJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </>
        }
        empty={{ title: 'Nenhum membro encontrado', description: 'Ajuste os filtros ou adicione um membro.' }}
      />
      <AddMemberDialog slug={slug} open={adding} onOpenChange={setAdding} />
    </>
  )
}
