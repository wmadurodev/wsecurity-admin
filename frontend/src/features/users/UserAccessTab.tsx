import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { isApiError } from '@/lib/api/errors'

import { getUserAccess, userKeys } from './api'
import { groupByModule } from './labels'

/** Tenants, papéis e permissões do usuário, pelo cliente de serviço do BFF (RF-USR-06, RF-BFF-03). */
export function UserAccessTab({ id }: { id: string }) {
  const query = useQuery({ queryKey: userKeys.access(id), queryFn: () => getUserAccess(id) })

  if (query.isPending) {
    return <LoadingState />
  }
  if (isApiError(query.error) && query.error.status === 503) {
    return (
      <Alert variant="warning">
        <AlertTitle>Consulta indisponível</AlertTitle>
        <AlertDescription>
          <p>O cliente de serviço do console não está configurado, ou o IdP recusou as credenciais dele.</p>
          {query.error.problem.detail && <p className="text-xs">{query.error.problem.detail}</p>}
        </AlertDescription>
      </Alert>
    )
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  if (query.data.tenants.length === 0) {
    return <EmptyState title="Sem vínculos" description="Este usuário não é membro de nenhum tenant." />
  }
  return (
    <Table>
      <TableCaption className="sr-only">Acessos do usuário nos tenants</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Papéis</TableHead>
          <TableHead>Permissões</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {query.data.tenants.map((tenant) => (
          <TableRow key={tenant.slug}>
            <TableCell className="align-top">
              <Link
                to={`/t/${encodeURIComponent(tenant.slug)}/members/${encodeURIComponent(id)}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {tenant.name}
              </Link>
              <div className="text-xs text-muted-foreground">{tenant.slug}</div>
            </TableCell>
            <TableCell className="align-top">
              <span className="flex flex-wrap gap-1">
                {tenant.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </span>
            </TableCell>
            <TableCell className="align-top">
              <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
                {groupByModule(tenant.permissions).map(([module, permissions]) => (
                  <div key={module} className="contents">
                    <dt className="font-medium">{module}</dt>
                    <dd className="font-mono">{permissions.join(', ')}</dd>
                  </div>
                ))}
              </dl>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
