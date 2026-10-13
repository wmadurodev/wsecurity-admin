import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DateTime } from '@/components/date-time'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { catalogKeys, type Module } from '@/features/catalog'
import { authz, type Page } from '@/lib/api/client'

import { disableModule, enableModule, listTenantModules, tenantKeys } from './api'

async function catalogModules(): Promise<Module[]> {
  return ((await authz.get('/admin/v1/modules', { query: { size: 100, sort: 'code,asc' } })).data as Page<Module>)
    .content
}

/** Módulos contratados (RF-TEN-04): contratar e cancelar; `core` é implícito e sem ação. */
export function TenantModulesSection({ slug, readOnly }: { slug: string; readOnly: boolean }) {
  const queryClient = useQueryClient()
  const selectId = useId()
  const modules = useQuery({ queryKey: tenantKeys.modules(slug), queryFn: () => listTenantModules(slug) })
  const catalog = useQuery({ queryKey: [...catalogKeys.all, 'all-modules'], queryFn: catalogModules })
  const [choice, setChoice] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: tenantKeys.modules(slug) }),
      queryClient.invalidateQueries({ queryKey: tenantKeys.detail(slug) }),
    ])
  const enable = useMutation({
    mutationFn: (module: string) => enableModule(slug, module),
    onSuccess: async (_, module) => {
      setChoice('')
      showSuccess(`Módulo ${module} contratado.`)
      await invalidate()
    },
    onError: (error) => showProblem(error),
  })
  const disable = useMutation({
    mutationFn: (module: string) => disableModule(slug, module),
    onSuccess: async (_, module) => {
      setCancelling(null)
      showSuccess(`Módulo ${module} cancelado.`)
      await invalidate()
    },
    onError: (error) => {
      setCancelling(null)
      showProblem(error)
    },
  })

  const contracted = new Set((modules.data ?? []).map((module) => module.module))
  const available = (catalog.data ?? []).filter(
    (module) => !module.system && module.enabled !== false && !contracted.has(module.code),
  )

  return (
    <section aria-labelledby="modulos-contratados" className="flex flex-col gap-3">
      <h2 id="modulos-contratados" className="text-lg font-semibold">
        Módulos contratados
      </h2>
      {modules.isPending && <LoadingState />}
      {modules.isError && <ErrorState error={modules.error} onRetry={() => void modules.refetch()} />}
      {modules.data && (
        <Table>
          <TableCaption className="sr-only">Módulos contratados pelo tenant</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Módulo</TableHead>
              <TableHead>Contratado em</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.data.map((module) => (
              <TableRow key={module.module}>
                <TableCell>
                  <code>{module.module}</code> {module.implicit && <Badge variant="secondary">implícito</Badge>}
                </TableCell>
                <TableCell>{module.implicit ? '—' : <DateTime value={module.enabledAt} />}</TableCell>
                <TableCell className="text-right">
                  {!module.implicit && !readOnly && (
                    <Button variant="outline" size="sm" onClick={() => setCancelling(module.module ?? '')}>
                      Cancelar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!readOnly && available.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (choice) {
              enable.mutate(choice)
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={selectId} className="text-sm font-medium">
              Contratar módulo
            </label>
            <Select id={selectId} value={choice} onChange={(event) => setChoice(event.target.value)} className="w-64">
              <option value="">Escolha um módulo</option>
              {available.map((module) => (
                <option key={module.code} value={module.code}>
                  {module.name} ({module.code})
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={!choice || enable.isPending}>
            Contratar
          </Button>
        </form>
      )}
      {cancelling && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setCancelling(null)}
          title={`Cancelar o módulo ${cancelling}`}
          description="As concessões das funcionalidades deste módulo deixam de valer no tenant até uma nova contratação. Os papéis não são alterados."
          confirmLabel="Cancelar módulo"
          pending={disable.isPending}
          onConfirm={() => disable.mutate(cancelling)}
        />
      )}
    </section>
  )
}
