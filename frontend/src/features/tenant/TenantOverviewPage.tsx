import { useQuery } from '@tanstack/react-query'
import { ScrollText, Shield, Users } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { PermissionGate } from '@/components/permission-gate'
import { ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/lib/session-context'

import { getTenantProfile, listMembers, tenantAreaKeys } from './api'
import { TenantProfileForm } from './TenantProfileForm'

/** Visão geral do tenant (RF-TAD-01) e edição dos dados com `core.tenant:write` (RF-TAD-02). */
export function TenantOverviewPage() {
  const { slug = '' } = useParams()
  const session = useSession()
  const query = useQuery({ queryKey: tenantAreaKeys.tenant(slug), queryFn: () => getTenantProfile(slug) })
  const canSeeMembers = session.can(slug, 'core.members:read')
  const count = { page: 0, size: 1 }
  const members = useQuery({
    queryKey: tenantAreaKeys.members(slug, count),
    queryFn: () => listMembers(slug, count),
    enabled: canSeeMembers,
  })

  if (query.isPending) {
    return <LoadingState />
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  const { tenant, etag } = query.data
  const roles = session.tenant(slug)?.roles ?? []
  const base = `/t/${encodeURIComponent(slug)}`
  return (
    <>
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
          <code className="text-sm text-muted-foreground">{tenant.slug}</code>
          <StatusBadge status={tenant.status} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Plano</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium">{tenant.plan ?? '—'}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Membros</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium" aria-live="polite">
            {canSeeMembers ? (members.data?.totalElements ?? '…') : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Seus papéis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <Badge key={role} variant="secondary">
                {role}
              </Badge>
            ))}
            {roles.length === 0 && session.isPlatformAdmin && (
              <span className="text-sm">Administrador da plataforma</span>
            )}
          </CardContent>
        </Card>
      </div>
      <section aria-labelledby="modulos" className="mt-6 flex flex-col gap-2">
        <h2 id="modulos" className="text-lg font-semibold">
          Módulos contratados
        </h2>
        <div className="flex flex-wrap gap-1">
          {(tenant.modules ?? []).map((module) => (
            <Badge key={module} variant="outline">
              {module}
            </Badge>
          ))}
          {(tenant.modules ?? []).length === 0 && <span className="text-sm text-muted-foreground">Nenhum.</span>}
        </div>
      </section>
      <nav aria-label="Atalhos" className="mt-6 flex flex-wrap gap-2">
        <PermissionGate tenant={slug} permission="core.members:read">
          <Link to={`${base}/members`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Users aria-hidden="true" />
            Membros
          </Link>
        </PermissionGate>
        <PermissionGate tenant={slug} permission="core.roles:read">
          <Link to={`${base}/roles`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Shield aria-hidden="true" />
            Papéis
          </Link>
        </PermissionGate>
        <PermissionGate tenant={slug} permission="core.audit:read">
          <Link to={`${base}/audit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ScrollText aria-hidden="true" />
            Auditoria
          </Link>
        </PermissionGate>
      </nav>
      <PermissionGate tenant={slug} permission="core.tenant:write">
        <section aria-labelledby="dados-tenant" className="mt-10 flex flex-col gap-3">
          <h2 id="dados-tenant" className="text-lg font-semibold">
            Dados
          </h2>
          <TenantProfileForm key={etag} tenant={tenant} etag={etag} onReload={() => void query.refetch()} />
        </section>
      </PermissionGate>
    </>
  )
}
