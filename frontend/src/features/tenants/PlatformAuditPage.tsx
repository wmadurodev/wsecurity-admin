import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/page-header'
import { useListParams } from '@/components/use-list-params'
import { type AuditEvent, AuditFilters, auditPeriod, AuditTable } from '@/features/audit'
import { authz, type Page } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'

/**
 * Auditoria da plataforma (RF-AUD-02) com filtros de tenant, titular, tipo e período na URL. O filtro de tenant
 * aceita o `slug`; a API recebe o `tenantId`.
 */
async function platformAudit(query: Record<string, string | number>): Promise<Page<AuditEvent>> {
  const { rest, from, to } = auditPeriod(query)
  const { tenant, ...filters } = rest
  const params: Record<string, string | number | undefined> = { ...filters, from, to }
  if (tenant) {
    try {
      params.tenantId = (await authz.get('/admin/v1/tenants/{tenant}', { path: { tenant: String(tenant) } })).data.id
    } catch (error) {
      if (isApiError(error) && error.isNotFound) {
        return { content: [], page: 0, size: Number(query.size ?? 20), totalElements: 0, totalPages: 0 }
      }
      throw error
    }
  }
  return (await authz.get('/admin/v1/audit-events', { query: params })).data as Page<AuditEvent>
}

export function PlatformAuditPage() {
  const params = useListParams()
  const query = useQuery({ queryKey: ['audit', 'platform', params.query], queryFn: () => platformAudit(params.query) })

  return (
    <>
      <PageHeader
        title="Auditoria da plataforma"
        description="Eventos de segurança da autorização, do mais recente para o mais antigo."
      />
      <AuditTable query={query} params={params} showTenant filters={<AuditFilters params={params} showTenant />} />
    </>
  )
}
