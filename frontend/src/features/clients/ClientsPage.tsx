import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { type Column, DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { useListParams } from '@/components/use-list-params'

import { type Client, clientKeys, listClients } from './api'

const columns: Column<Client>[] = [
  {
    key: 'name',
    header: 'Nome',
    cell: (client) => (
      <Link
        to={`/platform/clients/${encodeURIComponent(client.clientId ?? '')}`}
        className="font-medium underline-offset-4 hover:underline"
      >
        {client.name ?? client.clientId}
      </Link>
    ),
  },
  { key: 'clientId', header: 'client_id', cell: (client) => <code className="text-xs">{client.clientId}</code> },
  {
    key: 'type',
    header: 'Tipo',
    cell: (client) => <Badge variant="outline">{client.type === 'PUBLIC' ? 'público' : 'confidencial'}</Badge>,
  },
  {
    key: 'enabled',
    header: 'Situação',
    cell: (client) => <StatusBadge status={client.enabled ? 'ACTIVE' : 'DISABLED'} />,
  },
]

/** Clientes OAuth do IdP (RF-CLI-01). */
export function ClientsPage() {
  const params = useListParams()
  const query = useQuery({ queryKey: clientKeys.list(params.query), queryFn: () => listClients(params.query) })
  return (
    <>
      <PageHeader
        title="Clientes OAuth"
        description="Aplicações que obtêm tokens do IdP."
        actions={
          <Link to="/platform/clients/new" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            Novo cliente
          </Link>
        }
      />
      <DataTable
        caption="Clientes OAuth"
        columns={columns}
        query={query}
        params={params}
        rowKey={(client) => client.clientId ?? ''}
        empty={{ title: 'Nenhum cliente cadastrado' }}
      />
    </>
  )
}
