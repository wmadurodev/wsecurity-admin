import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { type Column, DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useListParams } from '@/components/use-list-params'

import { catalogKeys, listModules, type Module } from './api'
import { ModuleFormDialog } from './ModuleFormDialog'

const columns: Column<Module>[] = [
  {
    key: 'code',
    header: 'Código',
    sortBy: 'code',
    cell: (module) => (
      <Link
        to={`/platform/modules/${module.code}`}
        className="font-mono font-medium underline-offset-4 hover:underline"
      >
        {module.code}
      </Link>
    ),
  },
  {
    key: 'name',
    header: 'Nome',
    sortBy: 'name',
    cell: (module) => (
      <span className="flex items-center gap-2">
        {module.name}
        {module.system && <Badge variant="secondary">sistema</Badge>}
      </span>
    ),
  },
  {
    key: 'enabled',
    header: 'Situação',
    cell: (module) => <StatusBadge status={module.enabled === false ? 'DISABLED' : 'ACTIVE'} />,
  },
]

/** Catálogo de módulos (RF-CAT-01). */
export function ModulesPage() {
  const params = useListParams({ sort: 'code,asc' })
  const query = useQuery({ queryKey: catalogKeys.modules(params.query), queryFn: () => listModules(params.query) })
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  return (
    <>
      <PageHeader
        title="Módulos"
        description="Catálogo de módulos e funcionalidades que os tenants contratam e os papéis concedem."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Novo módulo
          </Button>
        }
      />
      <DataTable
        caption="Módulos do catálogo"
        columns={columns}
        query={query}
        params={params}
        rowKey={(module) => module.code ?? ''}
        empty={{ title: 'Nenhum módulo', action: <Button onClick={() => setCreating(true)}>Novo módulo</Button> }}
      />
      {creating && (
        <ModuleFormDialog
          onClose={(created) => {
            setCreating(false)
            if (created?.code) {
              void navigate(`/platform/modules/${created.code}`)
            }
          }}
        />
      )}
    </>
  )
}
