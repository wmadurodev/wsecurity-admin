import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ConflictNotice } from '@/components/conflict-notice'
import { PageHeader } from '@/components/page-header'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { ErrorState, LoadingState } from '@/components/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { catalogKeys, listAllFeatures } from '@/features/catalog'
import { type ApiError, isApiError } from '@/lib/api/errors'

import { createGlobalRole, deleteGlobalRole, getGlobalRole, grantsOf, roleKeys, updateGlobalRole } from './api'
import { PermissionMatrix } from './components/PermissionMatrix'
import { toMatrix } from './matrix-features'
import { RoleEditor } from './RoleEditor'

/** Criação de papel global (RF-ROL-01). */
export function NewGlobalRolePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const create = useMutation({
    mutationFn: createGlobalRole,
    onSuccess: async (role) => {
      showSuccess('Papel criado.')
      await queryClient.invalidateQueries({ queryKey: roleKeys.global })
      void navigate(`/platform/roles/${role.code}`)
    },
    onError: (error) => showProblem(error),
  })
  return (
    <>
      <PageHeader title="Novo papel global" description="Fica disponível para todos os tenants." />
      <RoleEditor
        initial={{ code: '', name: '', description: '' }}
        initialGrants={[]}
        creating
        submitLabel="Criar papel"
        pending={create.isPending}
        onSubmit={(values, grants) => create.mutate({ ...values, name: values.name.trim(), grants })}
      />
    </>
  )
}

/** Papel global ou de sistema (RF-ROL-01). Os de sistema são só leitura; a alteração afeta todos os tenants. */
export function GlobalRoleDetailPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const role = useQuery({ queryKey: roleKeys.globalRole(code), queryFn: () => getGlobalRole(code) })
  const features = useQuery({ queryKey: catalogKeys.allFeatures, queryFn: listAllFeatures })
  const [deleting, setDeleting] = useState(false)

  const save = useMutation({
    mutationFn: (input: Parameters<typeof updateGlobalRole>[1]) => updateGlobalRole(code, input, role.data?.etag),
    onSuccess: async () => {
      showSuccess('Papel atualizado.')
      await queryClient.invalidateQueries({ queryKey: roleKeys.global })
    },
    onError: (error) => {
      if (!(isApiError(error) && error.isConflict)) {
        showProblem(error)
      }
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteGlobalRole(code),
    onSuccess: async () => {
      showSuccess('Papel excluído.')
      await queryClient.invalidateQueries({ queryKey: roleKeys.global })
      void navigate('/platform/roles')
    },
    onError: (error) => {
      setDeleting(false)
      showProblem(error, 'Não foi possível excluir o papel')
    },
  })

  if (role.isPending) {
    return <LoadingState />
  }
  if (role.isError) {
    return <ErrorState error={role.error} onRetry={() => void role.refetch()} />
  }
  const data = role.data.role
  const system = data.scope === 'SYSTEM'
  const conflict = isApiError(save.error) && save.error.isConflict ? (save.error as ApiError) : undefined

  return (
    <>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <code className="text-sm text-muted-foreground">{data.code}</code>
          <Badge variant={system ? 'secondary' : 'outline'}>{system ? 'sistema (só leitura)' : 'global'}</Badge>
        </div>
        {data.description && <p className="max-w-2xl text-sm text-muted-foreground">{data.description}</p>}
        {!system && (
          <div>
            <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
              Excluir papel
            </Button>
          </div>
        )}
      </div>
      {system ? (
        <section className="flex flex-col gap-3">
          {data.dynamic ? (
            <p className="text-sm">Este papel concede todas as funcionalidades dos módulos contratados (dinâmico).</p>
          ) : features.data ? (
            <PermissionMatrix features={toMatrix(features.data)} grants={grantsOf(data)} readOnly />
          ) : (
            <LoadingState />
          )}
        </section>
      ) : (
        <>
          {conflict && (
            <div className="mb-4">
              <ConflictNotice
                error={conflict}
                onReload={() => {
                  save.reset()
                  void role.refetch()
                }}
              />
            </div>
          )}
          <RoleEditor
            key={role.data.etag}
            initial={{ code: data.code ?? '', name: data.name ?? '', description: data.description ?? '' }}
            initialGrants={grantsOf(data)}
            creating={false}
            submitLabel="Salvar papel"
            pending={save.isPending}
            notice={
              <Alert variant="warning">
                <AlertTriangle aria-hidden="true" />
                <AlertTitle>A alteração vale para todos os tenants</AlertTitle>
                <AlertDescription>
                  <p>
                    Todos os membros que têm este papel, em qualquer tenant, ganham ou perdem as permissões alteradas.
                  </p>
                </AlertDescription>
              </Alert>
            }
            onSubmit={(values, grants) =>
              save.mutate({ name: values.name.trim(), description: values.description, grants })
            }
          />
        </>
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Excluir o papel ${code}`}
        description="O papel deixa de existir. A API recusa a exclusão se ele estiver atribuído a algum membro."
        confirmLabel="Excluir papel"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}
