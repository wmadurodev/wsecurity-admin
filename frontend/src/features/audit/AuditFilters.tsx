import { type FormEvent, useId, useState } from 'react'

import type { ListParams } from '@/components/use-list-params'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import { AUDIT_TYPES } from './labels'

/**
 * Filtros da auditoria na URL (RF-AUD-01, RF-AUD-02): titular, tipo e período; o de tenant (`slug`) só na plataforma.
 * O tipo aplica na hora; os campos de texto, ao enviar.
 */
export function AuditFilters({ params, showTenant = false }: { params: ListParams; showTenant?: boolean }) {
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
      ...(showTenant ? { tenant: draft.tenant.trim() || undefined } : {}),
      subject: draft.subject.trim() || undefined,
      de: draft.de || undefined,
      ate: draft.ate || undefined,
    })
  }

  return (
    <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
      {showTenant && (
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
      )}
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
  )
}
