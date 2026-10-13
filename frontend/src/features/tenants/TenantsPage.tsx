import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Plus } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'

import { type Column, DataTable } from '@/components/data-table'
import { DateTime } from '@/components/date-time'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useListParams } from '@/components/use-list-params'

import { listTenants, type Tenant, tenantKeys } from './api'

const columns: Column<Tenant>[] = [
  {
    key: 'slug',
    header: 'Slug',
    sortBy: 'slug',
    cell: (tenant) => (
      <Link
        to={`/platform/tenants/${tenant.slug}`}
        className="font-mono font-medium underline-offset-4 hover:underline"
      >
        {tenant.slug}
      </Link>
    ),
  },
  { key: 'name', header: 'Nome', sortBy: 'name', cell: (tenant) => tenant.name },
  { key: 'plan', header: 'Plano', cell: (tenant) => tenant.plan ?? '—' },
  { key: 'status', header: 'Status', sortBy: 'status', cell: (tenant) => <StatusBadge status={tenant.status} /> },
  { key: 'created', header: 'Criado em', sortBy: 'createdAt', cell: (tenant) => <DateTime value={tenant.createdAt} /> },
  {
    key: 'area',
    header: 'Área',
    cell: (tenant) =>
      tenant.status === 'DELETED' ? null : (
        <Link
          to={`/t/${tenant.slug}`}
          className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Abrir área do tenant
        </Link>
      ),
  },
]

/** Tenants da plataforma (RF-TEN-02). Os excluídos aparecem só com o filtro explícito. */
export function TenantsPage() {
  const params = useListParams({ sort: 'createdAt,desc' })
  const query = useQuery({ queryKey: tenantKeys.list(params.query), queryFn: () => listTenants(params.query) })
  const statusId = useId()
  return (
    <>
      <PageHeader
        title="Tenants"
        description="Clientes da plataforma."
        actions={
          <Link to="/platform/tenants/new" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            Novo tenant
          </Link>
        }
      />
      <DataTable
        caption="Tenants da plataforma"
        columns={columns}
        query={query}
        params={params}
        rowKey={(tenant) => tenant.slug ?? ''}
        search={{ param: 'q', label: 'Busca', placeholder: 'slug ou nome' }}
        filters={
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
              <option value="">Ativos e suspensos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="SUSPENDED">Suspensos</option>
              <option value="DELETED">Excluídos</option>
            </Select>
          </div>
        }
        empty={{ title: 'Nenhum tenant encontrado', description: 'Ajuste a busca ou crie um tenant.' }}
      />
    </>
  )
}
