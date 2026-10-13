import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { PageHeader } from '@/components/page-header'
import { useListParams } from '@/components/use-list-params'
import { type AuditEvent, AuditFilters, auditPeriod, AuditTable } from '@/features/audit'
import { authz, type Page } from '@/lib/api/client'

async function tenantAudit(slug: string, query: Record<string, string | number>): Promise<Page<AuditEvent>> {
  const { rest, from, to } = auditPeriod(query)
  return (
    await authz.get('/v1/tenants/{tenant}/audit-events', {
      path: { tenant: slug },
      query: { ...rest, from, to },
    })
  ).data as Page<AuditEvent>
}

/** Auditoria do tenant (RF-AUD-01), com `core.audit:read`: titular, tipo e período na URL; sem IP e user-agent. */
export function TenantAuditPage() {
  const { slug = '' } = useParams()
  const params = useListParams()
  const query = useQuery({
    queryKey: ['audit', 'tenant', slug, params.query],
    queryFn: () => tenantAudit(slug, params.query),
  })

  return (
    <>
      <PageHeader title="Auditoria" description="Eventos de segurança do tenant, do mais recente para o mais antigo." />
      <AuditTable query={query} params={params} filters={<AuditFilters params={params} />} />
    </>
  )
}
