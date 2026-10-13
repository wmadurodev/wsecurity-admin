import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ConflictNotice } from '@/components/conflict-notice'
import { DateTime } from '@/components/date-time'
import { PermissionGate } from '@/components/permission-gate'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUserIdentities } from '@/features/users'
import { type ApiError, isApiError } from '@/lib/api/errors'
import { sessionKey, useSession } from '@/lib/session-context'

import {
  getMember,
  type Member,
  removeMember,
  replaceRoles,
  setExpiration,
  setMemberStatus,
  tenantAreaKeys,
} from './api'
import { isExpired, isLastOwner, LAST_OWNER_HELP, subjectTypeLabel, toIso, toLocalInput } from './labels'
import { CopySubject } from './MemberIdentity'
import { RolePicker } from './RolePicker'

type Confirming = 'suspend' | 'reactivate' | 'remove' | null

/** Erro do último dono (0002/RN-06), explicado. */
function LastOwnerAlert({ error }: { error: unknown }) {
  if (!(isApiError(error) && isLastOwner(error.problem.type))) {
    return null
  }
  return (
    <Alert variant="warning">
      <AlertTitle>{error.problem.title ?? 'O tenant ficaria sem dono'}</AlertTitle>
      <AlertDescription>
        <p>{LAST_OWNER_HELP}</p>
      </AlertDescription>
    </Alert>
  )
}

/** Detalhe do membro (RF-MEM-03): papéis, expiração, suspensão, reativação e remoção. */
export function MemberDetailPage() {
  const { slug = '', subject = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isPlatformAdmin, session } = useSession()
  const query = useQuery({
    queryKey: tenantAreaKeys.member(slug, subject),
    queryFn: () => getMember(slug, subject),
  })
  const isUser = query.data?.member.subjectType === 'USER'
  const identity = useUserIdentities(isUser ? [subject] : [], isPlatformAdmin).get(subject)
  const [confirming, setConfirming] = useState<Confirming>(null)
  const [lastError, setLastError] = useState<unknown>(null)

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: tenantAreaKeys.member(slug, subject) })
    await queryClient.invalidateQueries({ queryKey: tenantAreaKeys.membersAll(slug) })
    if (subject === session.sub) {
      await queryClient.invalidateQueries({ queryKey: sessionKey })
    }
  }

  const status = useMutation({
    mutationFn: (action: 'suspend' | 'reactivate') => setMemberStatus(slug, subject, action),
    onSuccess: async (_, action) => {
      setConfirming(null)
      setLastError(null)
      showSuccess(action === 'suspend' ? 'Membro suspenso.' : 'Membro reativado.')
      await refresh()
    },
    onError: (error) => {
      setConfirming(null)
      setLastError(error)
      showProblem(error)
    },
  })
  const remove = useMutation({
    mutationFn: () => removeMember(slug, subject),
    onSuccess: async () => {
      showSuccess('Membro removido do tenant.')
      await queryClient.invalidateQueries({ queryKey: tenantAreaKeys.membersAll(slug) })
      void navigate(`/t/${encodeURIComponent(slug)}/members`)
    },
    onError: (error) => {
      setConfirming(null)
      setLastError(error)
      showProblem(error)
    },
  })

  if (query.isPending) {
    return <LoadingState />
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  const { member, etag } = query.data
  const label = identity?.email ?? subject
  return (
    <>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{identity?.name ?? 'Membro'}</h1>
          {identity && <span className="text-muted-foreground">{identity.email}</span>}
          <StatusBadge status={member.status} />
          {isExpired(member) && <StatusBadge status="EXPIRED" />}
        </div>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Subject</dt>
          <dd>
            <CopySubject subject={subject} />
          </dd>
          <dt className="text-muted-foreground">Tipo</dt>
          <dd>{subjectTypeLabel(member.subjectType)}</dd>
          <dt className="text-muted-foreground">Membro desde</dt>
          <dd>
            <DateTime value={member.createdAt} />
          </dd>
          <dt className="text-muted-foreground">Atualizado em</dt>
          <dd>
            <DateTime value={member.updatedAt} />
          </dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          {isPlatformAdmin && isUser && (
            <Link
              to={`/platform/users/${encodeURIComponent(subject)}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink aria-hidden="true" />
              Ver usuário
            </Link>
          )}
          <PermissionGate tenant={slug} permission="core.members:write">
            {member.status === 'SUSPENDED' ? (
              <Button variant="outline" size="sm" onClick={() => setConfirming('reactivate')}>
                Reativar
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirming('suspend')}>
                Suspender
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => setConfirming('remove')}>
              Remover do tenant
            </Button>
          </PermissionGate>
        </div>
        <LastOwnerAlert error={lastError} />
      </div>
      <div className="flex flex-col gap-10">
        <section aria-labelledby="papeis-membro" className="flex flex-col gap-3">
          <h2 id="papeis-membro" className="text-lg font-semibold">
            Papéis
          </h2>
          <PermissionGate
            tenant={slug}
            permission="core.members:write"
            fallback={<RoleBadges roles={member.roles ?? []} />}
          >
            <RolesForm
              key={etag}
              slug={slug}
              member={member}
              etag={etag}
              onSaved={refresh}
              onReload={() => void query.refetch()}
            />
          </PermissionGate>
        </section>
        <section aria-labelledby="expiracao-membro" className="flex flex-col gap-3">
          <h2 id="expiracao-membro" className="text-lg font-semibold">
            Expiração
          </h2>
          <PermissionGate
            tenant={slug}
            permission="core.members:write"
            fallback={
              <p className="text-sm">{member.expiresAt ? <DateTime value={member.expiresAt} /> : 'Sem expiração.'}</p>
            }
          >
            <ExpirationForm
              key={etag}
              slug={slug}
              member={member}
              etag={etag}
              onSaved={refresh}
              onReload={() => void query.refetch()}
            />
          </PermissionGate>
        </section>
      </div>
      <ConfirmDialog
        open={confirming === 'suspend' || confirming === 'reactivate'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming === 'suspend' ? `Suspender ${label}` : `Reativar ${label}`}
        description={
          confirming === 'suspend'
            ? 'O membro suspenso não recebe nenhuma permissão no tenant até ser reativado. Os papéis são mantidos.'
            : 'O membro volta a ter as permissões dos seus papéis.'
        }
        confirmLabel={confirming === 'suspend' ? 'Suspender' : 'Reativar'}
        destructive={confirming === 'suspend'}
        pending={status.isPending}
        onConfirm={() => status.mutate(confirming === 'suspend' ? 'suspend' : 'reactivate')}
      />
      <ConfirmDialog
        open={confirming === 'remove'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Remover ${label}`}
        description="O vínculo e os papéis do membro neste tenant são apagados. A conta no IdP não é afetada."
        confirmLabel="Remover"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}

function RoleBadges({ roles }: { roles: string[] }) {
  if (roles.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem papéis.</p>
  }
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} variant="secondary">
          {role}
        </Badge>
      ))}
    </span>
  )
}

interface MemberFormProps {
  slug: string
  member: Member
  etag: string | undefined
  onSaved: () => Promise<void>
  onReload: () => void
}

/** Substitui os papéis com `If-Match`; `412` oferece recarregar e o último dono é explicado. */
function RolesForm({ slug, member, etag, onSaved, onReload }: MemberFormProps) {
  const subject = member.subject ?? ''
  const initial = member.roles ?? []
  const [roles, setRoles] = useState<string[]>(initial)
  const dirty = roles.length !== initial.length || roles.some((role) => !initial.includes(role))
  const save = useMutation({
    mutationFn: () => replaceRoles(slug, subject, roles, etag),
    onSuccess: async () => {
      showSuccess('Papéis do membro salvos.')
      await onSaved()
    },
    onError: (error) => {
      if (!(isApiError(error) && (error.status === 412 || isLastOwner(error.problem.type)))) {
        showProblem(error)
      }
    },
  })
  const error = save.error
  const stale = isApiError(error) && error.status === 412 ? (error as ApiError) : undefined
  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      {stale && (
        <ConflictNotice
          error={stale}
          onReload={() => {
            save.reset()
            onReload()
          }}
        />
      )}
      <LastOwnerAlert error={error} />
      <fieldset disabled={save.isPending}>
        <RolePicker slug={slug} legend="Papéis do membro" value={roles} onChange={setRoles} />
      </fieldset>
      <div>
        <Button type="submit" disabled={save.isPending || !dirty}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Salvar papéis
        </Button>
      </div>
    </form>
  )
}

/** Define ou remove a expiração do vínculo, com `If-Match`. */
function ExpirationForm({ slug, member, etag, onSaved, onReload }: MemberFormProps) {
  const id = useId()
  const subject = member.subject ?? ''
  const [value, setValue] = useState(toLocalInput(member.expiresAt))
  const [invalid, setInvalid] = useState(false)
  const save = useMutation({
    mutationFn: (expiresAt: string | null) => setExpiration(slug, subject, expiresAt, etag),
    onSuccess: async (_, expiresAt) => {
      showSuccess(expiresAt ? 'Expiração definida.' : 'Expiração removida.')
      await onSaved()
    },
    onError: (error) => {
      if (!(isApiError(error) && error.status === 412)) {
        showProblem(error)
      }
    },
  })
  const stale = isApiError(save.error) && save.error.status === 412 ? (save.error as ApiError) : undefined
  return (
    <form
      className="flex max-w-xl flex-col gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const future = Boolean(value) && new Date(value).getTime() > Date.now()
        setInvalid(!future)
        if (future) {
          save.mutate(toIso(value))
        }
      }}
    >
      {stale && (
        <ConflictNotice
          error={stale}
          onReload={() => {
            save.reset()
            onReload()
          }}
        />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          Expira em
        </label>
        <Input
          id={id}
          type="datetime-local"
          value={value}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-erro` : undefined}
          onChange={(event) => setValue(event.target.value)}
          className="w-64"
        />
        {invalid && (
          <p id={`${id}-erro`} role="alert" className="text-xs text-destructive">
            Informe uma data futura.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {member.expiresAt ? (
            <>
              Atual: <DateTime value={member.expiresAt} />
            </>
          ) : (
            'Sem expiração: o vínculo vale até ser removido.'
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Definir expiração
        </Button>
        {member.expiresAt && (
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => save.mutate(null)}>
            Remover expiração
          </Button>
        )}
      </div>
    </form>
  )
}
