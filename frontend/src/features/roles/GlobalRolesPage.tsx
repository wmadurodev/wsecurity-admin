import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { listGlobalRoles, roleKeys } from './api'

/** Papéis de sistema e globais (RF-ROL-01). */
export function GlobalRolesPage() {
  const roles = useQuery({ queryKey: roleKeys.global, queryFn: listGlobalRoles })
  return (
    <>
      <PageHeader
        title="Papéis globais"
        description="Papéis disponíveis para todos os tenants. Os de sistema são só leitura."
        actions={
          <Link to="/platform/roles/new" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            Novo papel
          </Link>
        }
      />
      {roles.isPending && <LoadingState />}
      {roles.isError && <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />}
      {roles.data?.length === 0 && <EmptyState title="Nenhum papel" />}
      {roles.data && roles.data.length > 0 && (
        <Table>
          <TableCaption className="sr-only">Papéis de sistema e globais</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Concessões</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...roles.data]
              .sort((a, b) =>
                a.scope === b.scope ? (a.code ?? '').localeCompare(b.code ?? '') : a.scope === 'SYSTEM' ? -1 : 1,
              )
              .map((role) => (
                <TableRow key={role.code}>
                  <TableCell>
                    <Link
                      to={`/platform/roles/${role.code}`}
                      className="font-mono font-medium underline-offset-4 hover:underline"
                    >
                      {role.code}
                    </Link>
                  </TableCell>
                  <TableCell>{role.name}</TableCell>
                  <TableCell>
                    <Badge variant={role.scope === 'SYSTEM' ? 'secondary' : 'outline'}>
                      {role.scope === 'SYSTEM' ? 'sistema' : 'global'}
                    </Badge>
                  </TableCell>
                  <TableCell>{role.dynamic ? 'todas (dinâmico)' : (role.grants?.length ?? 0)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
