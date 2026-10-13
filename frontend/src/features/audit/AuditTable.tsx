import type { UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'

import { type Column, DataTable } from '@/components/data-table'
import { DateTime } from '@/components/date-time'
import type { ListParams } from '@/components/use-list-params'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Page } from '@/lib/api/client'

import { auditTypeLabel } from './labels'

/** Evento de auditoria da autorização (plataforma e tenant têm o mesmo formato). */
export interface AuditEvent {
  id?: string
  occurredAt?: string
  type?: string
  outcome?: string
  tenantId?: string
  subjectId?: string
  clientId?: string
  actorId?: string
  ip?: string
  userAgent?: string
  traceId?: string
  details?: Record<string, unknown>
}

/**
 * Lista de eventos de auditoria (RF-AUD-01, RF-AUD-02) com paginação no servidor; o detalhe do evento abre num
 * painel lateral. Os filtros ficam com quem usa (`filters`), sincronizados com a URL por `params`.
 */
export function AuditTable({
  query,
  params,
  filters,
  showTenant = false,
}: {
  query: UseQueryResult<Page<AuditEvent>>
  params: ListParams
  filters?: React.ReactNode
  showTenant?: boolean
}) {
  const [selected, setSelected] = useState<AuditEvent | null>(null)
  const columns: Column<AuditEvent>[] = [
    { key: 'when', header: 'Data', cell: (event) => <DateTime value={event.occurredAt} /> },
    {
      key: 'type',
      header: 'Evento',
      cell: (event) => (
        <Button variant="link" className="h-auto p-0" onClick={() => setSelected(event)}>
          {auditTypeLabel(event.type)}
        </Button>
      ),
    },
    {
      key: 'outcome',
      header: 'Resultado',
      cell: (event) =>
        event.outcome === 'FAILURE' ? (
          <Badge variant="destructive">falha</Badge>
        ) : (
          <Badge variant="secondary">sucesso</Badge>
        ),
    },
    {
      key: 'actor',
      header: 'Quem fez',
      cell: (event) => <code className="text-xs">{event.actorId ?? event.clientId ?? '—'}</code>,
    },
    { key: 'subject', header: 'Titular', cell: (event) => <code className="text-xs">{event.subjectId ?? '—'}</code> },
    ...(showTenant
      ? [
          {
            key: 'tenant',
            header: 'Tenant',
            cell: (event: AuditEvent) => <code className="text-xs">{event.tenantId ?? '—'}</code>,
          },
        ]
      : []),
  ]
  return (
    <>
      <DataTable
        caption="Eventos de auditoria"
        columns={columns}
        query={query}
        params={params}
        rowKey={(event) => event.id ?? `${event.occurredAt}-${event.type}`}
        filters={filters}
        empty={{ title: 'Nenhum evento encontrado', description: 'Ajuste os filtros ou o período.' }}
      />
      {selected && (
        <Dialog open side onOpenChange={(open) => !open && setSelected(null)} aria-labelledby="evento-titulo">
          <DialogClose onClose={() => setSelected(null)} />
          <DialogHeader>
            <DialogTitle id="evento-titulo">{auditTypeLabel(selected.type)}</DialogTitle>
          </DialogHeader>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Data</dt>
            <dd>
              <DateTime value={selected.occurredAt} />
            </dd>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>
              <code className="text-xs">{selected.type}</code>
            </dd>
            <dt className="text-muted-foreground">Resultado</dt>
            <dd>{selected.outcome === 'FAILURE' ? 'falha' : 'sucesso'}</dd>
            {(
              [
                ['Quem fez', selected.actorId],
                ['Cliente', selected.clientId],
                ['Titular', selected.subjectId],
                ['Tenant', selected.tenantId],
                ['IP', selected.ip],
                ['Navegador', selected.userAgent],
                ['Rastreamento', selected.traceId],
              ] as const
            )
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-mono text-xs break-all">{value}</dd>
                </div>
              ))}
          </dl>
          {selected.details && Object.keys(selected.details).length > 0 && (
            <>
              <h3 className="mt-4 mb-1 text-sm font-medium">Detalhes</h3>
              <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(selected.details, null, 2)}
              </pre>
            </>
          )}
        </Dialog>
      )}
    </>
  )
}
