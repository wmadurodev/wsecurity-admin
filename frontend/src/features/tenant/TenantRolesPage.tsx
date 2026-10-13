import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/components/page-header'
import { PermissionGate } from '@/components/permission-gate'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { listTenantRoles, type TenantRole, tenantAreaKeys } from './api'
import { ROLE_ORIGIN } from './labels'

const ORDER: Record<string, number> = { SYSTEM: 0, GLOBAL: 1, TENANT: 2 }

/**
 * Papéis disponíveis ao tenant (RF-ROL-02), com a origem de cada um. A API não informa o número de membros por papel,
 * então a coluna não existe. Criar, alterar e excluir valem só para os papéis do tenant, com `core.roles:write`.
 */
export function TenantRolesPage() {
  const { slug = '' } = useParams()
  const roles = useQuery({ queryKey: tenantAreaKeys.roles(slug), queryFn: () => listTenantRoles(slug) })
  const base = `/t/${encodeURIComponent(slug)}/roles`
  const sorted = (list: TenantRole[]) =>
    [...list].sort(
      (a, b) => (ORDER[a.scope ?? ''] ?? 9) - (ORDER[b.scope ?? ''] ?? 9) || (a.code ?? '').localeCompare(b.code ?? ''),
    )

  return (
    <>
      <PageHeader
        title="Papéis"
        description="Papéis de sistema e globais valem para todos os tenants e são só leitura aqui."
        actions={
          <PermissionGate tenant={slug} permission="core.roles:write">
            <Link to={`${base}/new`} className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Novo papel
            </Link>
          </PermissionGate>
        }
      />
      {roles.isPending && <LoadingState />}
      {roles.isError && <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />}
      {roles.data?.length === 0 && <EmptyState title="Nenhum papel" />}
      {roles.data && roles.data.length > 0 && (
        <Table>
          <TableCaption className="sr-only">Papéis disponíveis ao tenant</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Concessões</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted(roles.data).map((role) => (
              <TableRow key={role.code}>
                <TableCell>
                  <Link
                    to={`${base}/${encodeURIComponent(role.code ?? '')}`}
                    className="font-mono font-medium underline-offset-4 hover:underline"
                  >
                    {role.code}
                  </Link>
                </TableCell>
                <TableCell>{role.name}</TableCell>
                <TableCell>
                  <Badge variant={role.scope === 'TENANT' ? 'outline' : 'secondary'}>
                    {ROLE_ORIGIN[role.scope ?? ''] ?? role.scope}
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
