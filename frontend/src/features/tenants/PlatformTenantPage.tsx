import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DateTime } from '@/components/date-time'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { sessionKey } from '@/lib/session-context'

import { deleteTenant, getTenant, setTenantStatus, tenantKeys } from './api'
import { TenantDataForm } from './TenantDataForm'
import { TenantModulesSection } from './TenantModulesSection'

/** Tenant na plataforma (RF-TEN-03, RF-TEN-04): dados, status, exclusão e módulos contratados. */
export function PlatformTenantPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: tenantKeys.detail(slug), queryFn: () => getTenant(slug) })
  const [confirming, setConfirming] = useState<'suspend' | 'activate' | 'delete' | null>(null)

  const status = useMutation({
    mutationFn: (action: 'suspend' | 'activate') => setTenantStatus(slug, action),
    onSuccess: async (_, action) => {
      setConfirming(null)
      showSuccess(action === 'suspend' ? 'Tenant suspenso.' : 'Tenant reativado.')
      await queryClient.invalidateQueries({ queryKey: tenantKeys.all })
      await queryClient.invalidateQueries({ queryKey: sessionKey })
    },
    onError: (error) => {
      setConfirming(null)
      showProblem(error)
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteTenant(slug),
    onSuccess: async () => {
      showSuccess('Tenant excluído.')
      await queryClient.invalidateQueries({ queryKey: tenantKeys.all })
      await queryClient.invalidateQueries({ queryKey: sessionKey })
      void navigate('/platform/tenants')
    },
    onError: (error) => {
      setConfirming(null)
      showProblem(error)
    },
  })

  if (query.isPending) {
    return <LoadingState />
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  const { tenant, etag } = query.data
  const deleted = tenant.status === 'DELETED'
  return (
    <>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
          <code className="text-sm text-muted-foreground">{tenant.slug}</code>
          <StatusBadge status={tenant.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Criado em <DateTime value={tenant.createdAt} />
          {deleted && (
            <>
              {' '}
              · excluído em <DateTime value={tenant.deletedAt} />
            </>
          )}
        </p>
        {!deleted && (
          <div className="flex flex-wrap gap-2">
            <Link to={`/t/${tenant.slug}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <ExternalLink aria-hidden="true" />
              Abrir área do tenant
            </Link>
            {tenant.status === 'ACTIVE' ? (
              <Button variant="outline" size="sm" onClick={() => setConfirming('suspend')}>
                Suspender
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirming('activate')}>
                Reativar
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => setConfirming('delete')}>
              Excluir
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-10">
        <section aria-labelledby="dados-tenant" className="flex flex-col gap-3">
          <h2 id="dados-tenant" className="text-lg font-semibold">
            Dados
          </h2>
          <TenantDataForm key={etag} tenant={tenant} etag={etag} onReload={() => void query.refetch()} />
        </section>
        <TenantModulesSection slug={slug} readOnly={deleted} />
      </div>
      <ConfirmDialog
        open={confirming === 'suspend' || confirming === 'activate'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming === 'suspend' ? `Suspender ${slug}` : `Reativar ${slug}`}
        description={
          confirming === 'suspend'
            ? 'Um tenant suspenso não concede nenhuma permissão: os membros perdem o acesso até a reativação. Nada é apagado.'
            : 'Os membros voltam a ter as permissões dos seus papéis.'
        }
        confirmLabel={confirming === 'suspend' ? 'Suspender' : 'Reativar'}
        destructive={confirming === 'suspend'}
        pending={status.isPending}
        onConfirm={() => status.mutate(confirming === 'suspend' ? 'suspend' : 'activate')}
      />
      <ConfirmDialog
        open={confirming === 'delete'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Excluir ${slug}`}
        description="A exclusão é irreversível: os vínculos e as permissões do tenant deixam de existir, e o slug fica reservado (não pode ser reutilizado)."
        confirmLabel="Excluir tenant"
        requireText={slug}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}
