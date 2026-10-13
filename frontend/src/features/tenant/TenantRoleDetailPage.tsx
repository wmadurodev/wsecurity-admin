import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
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
import { grantsOf, PermissionMatrix, RoleEditor } from '@/features/roles'
import { type ApiError, isApiError } from '@/lib/api/errors'
import { useSession } from '@/lib/session-context'

import {
  createTenantRole,
  deleteTenantRole,
  getTenantRole,
  tenantAreaKeys,
  tenantRoleKeys,
  updateTenantRole,
  type UpdateTenantRole,
} from './api'
import { isPrivilegeEscalation, ROLE_ORIGIN } from './labels'
import { coversGrants, grantChecker } from './permissions'
import { useTenantMatrix, withGrantedFeatures } from './role-matrix'

/** `403 privilege-escalation` explicado (0002/RN-07); os demais erros seguem como toast. */
function EscalationAlert({ error }: { error: unknown }) {
  if (!(isApiError(error) && isPrivilegeEscalation(error.problem.type))) {
    return null
  }
  return (
    <Alert variant="destructive">
      <ShieldAlert aria-hidden="true" />
      <AlertTitle>{error.problem.title ?? 'Escalonamento de privilégio negado'}</AlertTitle>
      <AlertDescription>
        <p>
          {error.problem.detail ??
            'Você só pode conceder ou retirar permissões que possui; papéis e vínculos de donos exigem ser dono.'}
        </p>
      </AlertDescription>
    </Alert>
  )
}

/** Erros mostrados na própria tela (`412` e anti-escalonamento); os demais vão para o toast. */
const quietErrors = (error: unknown) =>
  isApiError(error) && (error.status === 412 || isPrivilegeEscalation(error.problem.type))

/** Criação de papel do tenant (RF-ROL-02), com a matriz limitada pelo anti-escalonamento (RF-ROL-03). */
export function NewTenantRolePage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const matrix = useTenantMatrix(slug)
  const create = useMutation({
    mutationFn: (body: Parameters<typeof createTenantRole>[1]) => createTenantRole(slug, body),
    onSuccess: async (role) => {
      showSuccess('Papel criado.')
      await queryClient.invalidateQueries({ queryKey: tenantAreaKeys.roles(slug) })
      void navigate(`/t/${encodeURIComponent(slug)}/roles/${encodeURIComponent(role.code ?? '')}`)
    },
    onError: (error) => {
      if (!quietErrors(error)) {
        showProblem(error)
      }
    },
  })
  return (
    <>
      <PageHeader title="Novo papel" description="Fica disponível só para este tenant." />
      <RoleEditor
        initial={{ code: '', name: '', description: '' }}
        initialGrants={[]}
        creating
        submitLabel="Criar papel"
        pending={create.isPending}
        matrix={matrix}
        notice={<EscalationAlert error={create.error} />}
        onSubmit={(values, grants) => create.mutate({ ...values, name: values.name.trim(), grants })}
      />
    </>
  )
}

/**
 * Papel disponível ao tenant (RF-ROL-02, RF-ROL-03). Os de sistema e globais aparecem só para leitura, com as
 * concessões. Os do tenant são editáveis com `core.roles:write` quando o chamador possui todas as concessões atuais.
 */
export function TenantRoleDetailPage() {
  const { slug = '', code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useSession()
  const matrix = useTenantMatrix(slug)
  const role = useQuery({ queryKey: tenantRoleKeys.role(slug, code), queryFn: () => getTenantRole(slug, code) })
  const [deleting, setDeleting] = useState(false)

  const save = useMutation({
    mutationFn: (body: UpdateTenantRole) => updateTenantRole(slug, code, body, role.data?.etag),
    onSuccess: async () => {
      showSuccess('Papel atualizado.')
      await queryClient.invalidateQueries({ queryKey: tenantAreaKeys.roles(slug) })
    },
    onError: (error) => {
      if (!quietErrors(error)) {
        showProblem(error)
      }
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteTenantRole(slug, code),
    onSuccess: async () => {
      showSuccess('Papel excluído.')
      await queryClient.invalidateQueries({ queryKey: tenantAreaKeys.roles(slug) })
      void navigate(`/t/${encodeURIComponent(slug)}/roles`)
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
  const tenantOwned = data.scope === 'TENANT'
  const writable = session.can(slug, 'core.roles:write')
  const covered = coversGrants(grantChecker(session, slug), data.grants)
  const editable = tenantOwned && writable && covered
  const conflict = isApiError(save.error) && save.error.status === 412 ? (save.error as ApiError) : undefined

  return (
    <>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <code className="text-sm text-muted-foreground">{data.code}</code>
          <Badge variant={tenantOwned ? 'outline' : 'secondary'}>
            {ROLE_ORIGIN[data.scope ?? ''] ?? data.scope}
            {!editable && ' (só leitura)'}
          </Badge>
        </div>
        {data.description && <p className="max-w-2xl text-sm text-muted-foreground">{data.description}</p>}
        {editable && (
          <div>
            <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
              Excluir papel
            </Button>
          </div>
        )}
        {tenantOwned && writable && !covered && (
          <Alert variant="warning">
            <ShieldAlert aria-hidden="true" />
            <AlertTitle>Você não pode alterar este papel</AlertTitle>
            <AlertDescription>
              <p>
                Ele concede permissões que você não possui. Só o dono do tenant ou o administrador da plataforma podem
                alterá-lo ou excluí-lo (anti-escalonamento).
              </p>
            </AlertDescription>
          </Alert>
        )}
      </div>
      {editable ? (
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
            matrix={matrix}
            notice={<EscalationAlert error={save.error} />}
            onSubmit={(values, grants) =>
              save.mutate({ name: values.name.trim(), description: values.description, grants })
            }
          />
        </>
      ) : (
        <section className="flex flex-col gap-3" aria-labelledby="concessoes-papel">
          <h2 id="concessoes-papel" className="text-lg font-semibold">
            Concessões
          </h2>
          {data.dynamic ? (
            <p className="text-sm">Este papel concede todas as funcionalidades dos módulos contratados (dinâmico).</p>
          ) : matrix.features ? (
            <PermissionMatrix
              features={withGrantedFeatures(matrix.features, data.grants)}
              grants={grantsOf(data)}
              readOnly
            />
          ) : matrix.pending ? (
            <LoadingState />
          ) : (
            <ErrorState error={matrix.error} onRetry={matrix.onRetry} />
          )}
        </section>
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Excluir o papel ${code}`}
        description="O papel deixa de existir neste tenant. A API recusa a exclusão se ele estiver atribuído a algum membro."
        confirmLabel="Excluir papel"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}
