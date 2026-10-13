import { useQuery } from '@tanstack/react-query'

import { type Column, DataTable } from '@/components/data-table'
import { DateTime } from '@/components/date-time'
import { Badge } from '@/components/ui/badge'
import { useListParams } from '@/components/use-list-params'

import { listUserEvents, type UserEvent, userKeys } from './api'
import { eventLabel } from './labels'

const columns: Column<UserEvent>[] = [
  { key: 'when', header: 'Data', cell: (event) => <DateTime value={event.occurredAt} /> },
  { key: 'type', header: 'Evento', cell: (event) => eventLabel(event.type) },
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
  { key: 'ip', header: 'IP', cell: (event) => event.ip ?? '—' },
  { key: 'client', header: 'Cliente', cell: (event) => event.clientId ?? '—' },
  {
    key: 'details',
    header: 'Detalhes',
    cell: (event) =>
      event.details && Object.keys(event.details).length > 0 ? (
        <code className="text-xs break-all">{JSON.stringify(event.details)}</code>
      ) : (
        '—'
      ),
  },
]

/** Eventos de auditoria do usuário no IdP, do mais recente para o mais antigo (RF-USR-05). */
export function UserEventsTab({ id }: { id: string }) {
  const params = useListParams({ exclude: ['aba'] })
  const query = useQuery({
    queryKey: userKeys.events(id, params.query),
    queryFn: () => listUserEvents(id, params.query),
  })
  return (
    <DataTable
      caption="Eventos do usuário"
      columns={columns}
      query={query}
      params={params}
      rowKey={(event) => event.id ?? `${event.occurredAt}-${event.type}`}
      empty={{ title: 'Nenhum evento registrado' }}
    />
  )
}
