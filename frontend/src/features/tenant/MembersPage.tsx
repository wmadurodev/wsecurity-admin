import { useQuery } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useParams } from 'react-router'

import { type Column, DataTable } from '@/components/data-table'
import { DateTime } from '@/components/date-time'
import { PageHeader } from '@/components/page-header'
import { PermissionGate } from '@/components/permission-gate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useListParams } from '@/components/use-list-params'

import { AddMemberDialog } from './AddMemberDialog'
import { listMembers, type Member, tenantAreaKeys } from './api'
import { MEMBER_STATUS_OPTIONS, memberProfile, SUBJECT_TYPE_OPTIONS, subjectTypeLabel } from './labels'
import { MemberIdentity, MemberStatus } from './MemberIdentity'

function columns(slug: string): Column<Member>[] {
  return [
    {
      key: 'subject',
      header: 'Identificação',
      sortBy: 'subject',
      cell: (member) => {
        const subject = member.subject ?? ''
        return (
          <span className="flex items-center gap-2">
            <MemberIdentity member={member} />
            <Link
              to={`/t/${encodeURIComponent(slug)}/members/${encodeURIComponent(subject)}`}
              className="text-sm underline underline-offset-4"
              aria-label={`Abrir o membro ${memberProfile(member)?.email ?? subject}`}
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
      cell: (member) => <MemberStatus member={member} />,
    },
    { key: 'expiresAt', header: 'Expiração', cell: (member) => <DateTime value={member.expiresAt} /> },
  ]
}

/** Membros do tenant (RF-MEM-01), com filtros de status, papel e tipo, e nome e e-mail vindos da API (fase 0008). */
export function MembersPage() {
  const { slug = '' } = useParams()
  const params = useListParams({ sort: 'createdAt,desc' })
  const query = useQuery({
    queryKey: tenantAreaKeys.members(slug, params.query),
    queryFn: () => listMembers(slug, params.query),
  })
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
        columns={columns(slug)}
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
