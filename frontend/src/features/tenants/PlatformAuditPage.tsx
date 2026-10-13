import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useId, useState } from 'react'

import { PageHeader } from '@/components/page-header'
import { useListParams } from '@/components/use-list-params'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { AUDIT_TYPES, type AuditEvent, AuditTable } from '@/features/audit'
import { authz, type Page } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'

const toIso = (local: string | undefined) => (local ? new Date(local).toISOString() : undefined)

/**
 * Auditoria da plataforma (RF-AUD-02) com filtros de tenant, titular, tipo e período na URL. O filtro de tenant
 * aceita o `slug`; a API recebe o `tenantId`.
 */
async function platformAudit(query: Record<string, string | number>): Promise<Page<AuditEvent>> {
  const { tenant, de, ate, ...rest } = query
  const params: Record<string, string | number | undefined> = {
    ...rest,
    from: toIso(de as string),
    to: toIso(ate as string),
  }
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
  const ids = { tenant: useId(), subject: useId(), type: useId(), from: useId(), to: useId() }
  const [draft, setDraft] = useState({
    tenant: params.get('tenant') ?? '',
    subject: params.get('subject') ?? '',
    de: params.get('de') ?? '',
    ate: params.get('ate') ?? '',
  })

  function apply(event: FormEvent) {
    event.preventDefault()
    params.set({
      tenant: draft.tenant.trim() || undefined,
      subject: draft.subject.trim() || undefined,
      de: draft.de || undefined,
      ate: draft.ate || undefined,
    })
  }

  return (
    <>
      <PageHeader
        title="Auditoria da plataforma"
        description="Eventos de segurança da autorização, do mais recente para o mais antigo."
      />
      <AuditTable
        query={query}
        params={params}
        showTenant
        filters={
          <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.tenant} className="text-sm font-medium">
                Tenant (slug)
              </label>
              <Input
                id={ids.tenant}
                value={draft.tenant}
                onChange={(event) => setDraft({ ...draft, tenant: event.target.value })}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.subject} className="text-sm font-medium">
                Titular (sub)
              </label>
              <Input
                id={ids.subject}
                value={draft.subject}
                onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                className="w-64"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.type} className="text-sm font-medium">
                Tipo
              </label>
              <Select
                id={ids.type}
                value={params.get('type') ?? ''}
                onChange={(event) => params.set({ type: event.target.value || undefined })}
                className="w-56"
              >
                <option value="">Todos</option>
                {Object.entries(AUDIT_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.from} className="text-sm font-medium">
                De
              </label>
              <Input
                id={ids.from}
                type="datetime-local"
                value={draft.de}
                onChange={(event) => setDraft({ ...draft, de: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.to} className="text-sm font-medium">
                Até
              </label>
              <Input
                id={ids.to}
                type="datetime-local"
                value={draft.ate}
                onChange={(event) => setDraft({ ...draft, ate: event.target.value })}
              />
            </div>
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
          </form>
        }
      />
    </>
  )
}
