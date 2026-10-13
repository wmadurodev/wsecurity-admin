import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { catalogKeys, deleteFeature, deleteModule, type Feature, getModule, listFeatures } from './api'
import { FeatureFormDialog } from './FeatureFormDialog'
import { ModuleFormDialog } from './ModuleFormDialog'

/** Módulo e as funcionalidades dele, agrupadas por categoria (RF-CAT-01, RF-CAT-02). `core.*` é só leitura. */
export function ModuleDetailPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const module = useQuery({ queryKey: catalogKeys.module(code), queryFn: () => getModule(code) })
  const features = useQuery({ queryKey: catalogKeys.features(code), queryFn: () => listFeatures(code) })
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [featureForm, setFeatureForm] = useState<{ feature?: Feature } | null>(null)
  const [removing, setRemoving] = useState<Feature | null>(null)

  const removeModule = useMutation({
    mutationFn: () => deleteModule(code),
    onSuccess: async () => {
      showSuccess('Módulo excluído.')
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all })
      void navigate('/platform/modules')
    },
    onError: (error) => {
      setDeleting(false)
      showProblem(error, 'Não foi possível excluir o módulo')
    },
  })
  const removeFeature = useMutation({
    mutationFn: (feature: Feature) => deleteFeature(code, feature.code ?? ''),
    onSuccess: async () => {
      setRemoving(null)
      showSuccess('Funcionalidade excluída.')
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all })
    },
    onError: (error) => {
      setRemoving(null)
      showProblem(error, 'Não foi possível excluir a funcionalidade')
    },
  })

  if (module.isPending) {
    return <LoadingState />
  }
  if (module.isError) {
    return <ErrorState error={module.error} onRetry={() => void module.refetch()} />
  }
  const system = Boolean(module.data.system)
  const categories = new Map<string, Feature[]>()
  for (const feature of [...(features.data ?? [])].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''))) {
    const category = feature.category?.trim() || 'Geral'
    categories.set(category, [...(categories.get(category) ?? []), feature])
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{module.data.name}</h1>
          <code className="text-sm text-muted-foreground">{module.data.code}</code>
          <StatusBadge status={module.data.enabled === false ? 'DISABLED' : 'ACTIVE'} />
          {system && <Badge variant="secondary">sistema (só leitura)</Badge>}
        </div>
        {module.data.description && (
          <p className="max-w-2xl text-sm text-muted-foreground">{module.data.description}</p>
        )}
        {!system && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Editar módulo
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
              Excluir módulo
            </Button>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Funcionalidades</h2>
        {!system && (
          <Button size="sm" onClick={() => setFeatureForm({})}>
            <Plus aria-hidden="true" />
            Nova funcionalidade
          </Button>
        )}
      </div>
      {features.isPending && <LoadingState />}
      {features.isError && <ErrorState error={features.error} onRetry={() => void features.refetch()} />}
      {features.data?.length === 0 && (
        <EmptyState
          title="Nenhuma funcionalidade"
          description="Cadastre as funcionalidades que os papéis vão conceder."
          action={!system && <Button onClick={() => setFeatureForm({})}>Nova funcionalidade</Button>}
        />
      )}
      {[...categories.entries()].map(([category, items]) => (
        <section key={category} className="mb-6" aria-label={`Categoria ${category}`}>
          <h3 className="mb-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">{category}</h3>
          <Table>
            <TableCaption className="sr-only">Funcionalidades da categoria {category}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((feature) => (
                <TableRow key={feature.code}>
                  <TableCell>
                    <code className="text-xs">{feature.code}</code>
                  </TableCell>
                  <TableCell>
                    {feature.name}
                    {feature.description && <div className="text-xs text-muted-foreground">{feature.description}</div>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={feature.enabled === false ? 'DISABLED' : 'ACTIVE'} />
                  </TableCell>
                  <TableCell className="text-right">
                    {!feature.system && !system && (
                      <span className="inline-flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setFeatureForm({ feature })}>
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setRemoving(feature)}>
                          Excluir
                        </Button>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}

      {editing && <ModuleFormDialog module={module.data} onClose={() => setEditing(false)} />}
      {featureForm && (
        <FeatureFormDialog module={code} feature={featureForm.feature} onClose={() => setFeatureForm(null)} />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Excluir o módulo ${code}`}
        description="Só é possível excluir um módulo sem funcionalidades e que nenhum tenant contrata. Se não for possível, a API explica o motivo."
        confirmLabel="Excluir módulo"
        pending={removeModule.isPending}
        onConfirm={() => removeModule.mutate()}
      />
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Excluir ${removing.code}`}
          description="A funcionalidade sai do catálogo. Se algum papel a concede, a API recusa e explica."
          confirmLabel="Excluir"
          pending={removeFeature.isPending}
          onConfirm={() => removeFeature.mutate(removing)}
        />
      )}
    </>
  )
}
