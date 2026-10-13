import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'

import { ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { DateTime } from '@/components/date-time'

import { getUser, userKeys } from './api'
import { UserAccessTab } from './UserAccessTab'
import { UserActions } from './UserActions'
import { UserDataForm } from './UserDataForm'
import { UserEventsTab } from './UserEventsTab'

/** Detalhe do usuário (RF-USR-02): cabeçalho, ações e abas "Dados", "Eventos" e "Acessos". */
export function UserDetailPage() {
  const { id = '' } = useParams()
  const [search, setSearch] = useSearchParams()
  const query = useQuery({ queryKey: userKeys.detail(id), queryFn: () => getUser(id) })
  const tab = search.get('aba') ?? 'dados'

  if (query.isPending) {
    return <LoadingState />
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  const { user, etag } = query.data
  return (
    <>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{user.name ?? user.email}</h1>
          <StatusBadge status={user.status} />
          {user.locked && <StatusBadge status="LOCKED" />}
          {user.wsecurityAdmin && <Badge>administrador da plataforma</Badge>}
          {user.mustChangePassword && <Badge variant="outline">troca de senha pendente</Badge>}
          {!user.emailVerified && <Badge variant="outline">e-mail não verificado</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {user.email} · último acesso <DateTime value={user.lastLoginAt} /> · criado em{' '}
          <DateTime value={user.createdAt} />
        </p>
        <p className="text-xs text-muted-foreground">
          MFA: a API administrativa não informa se o segundo fator está ativo; use "Remover MFA" para zerá-lo (Q-08).
        </p>
        <UserActions user={user} />
      </div>
      <Tabs
        label="Seções do usuário"
        value={tab}
        onValueChange={(value) => setSearch(value === 'dados' ? {} : { aba: value }, { replace: true })}
        items={[
          {
            value: 'dados',
            label: 'Dados',
            content: <UserDataForm user={user} etag={etag} onReload={() => void query.refetch()} />,
          },
          { value: 'eventos', label: 'Eventos', content: <UserEventsTab id={id} /> },
          { value: 'acessos', label: 'Acessos', content: <UserAccessTab id={id} /> },
        ]}
      />
    </>
  )
}
