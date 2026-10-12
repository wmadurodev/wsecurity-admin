import { useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { onUnauthorized } from './api/client'
import {
  fetchSession,
  hasAdministrativeAccess,
  hasPermission,
  type Session,
  SessionExpiredError,
  type SessionTenant,
  signInAgain,
} from './session'

export const sessionKey = ['session'] as const

export interface SessionValue {
  session: Session
  isPlatformAdmin: boolean
  /** Tenant administrável da sessão, se houver. */
  tenant: (slug: string) => SessionTenant | undefined
  /** O chamador tem a permissão no tenant (RF-NAV-08). O administrador da plataforma tem todas. */
  can: (slug: string, permission: string) => boolean
  /** Um `401` do BFF foi recebido: a sessão expirou (RF-AUT-05). */
  expired: boolean
  signInAgain: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

/**
 * Carrega `GET /bff/session` e o disponibiliza para a SPA. Sem acesso administrativo, vai para `/no-access`
 * (RF-AUT-07). Um `401` em qualquer chamada marca a sessão como expirada; no Vite, o login começa direto.
 */
export function SessionProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const query = useQuery({ queryKey: sessionKey, queryFn: fetchSession, staleTime: 60_000 })
  const [unauthorized, setUnauthorized] = useState(false)
  useEffect(() => onUnauthorized(() => setUnauthorized(true)), [])

  const expired = unauthorized || query.error instanceof SessionExpiredError
  const noAccess = query.data !== undefined && !hasAdministrativeAccess(query.data)

  useEffect(() => {
    if (noAccess) {
      window.location.assign('/no-access')
    }
  }, [noAccess])
  useEffect(() => {
    if (expired && query.data === undefined && import.meta.env.DEV) {
      signInAgain(true)
    }
  }, [expired, query.data])

  const session = query.data
  const tenant = useCallback((slug: string) => session?.tenants.find((item) => item.slug === slug), [session])
  const value = useMemo<SessionValue | null>(() => {
    if (!session) {
      return null
    }
    return {
      session,
      isPlatformAdmin: session.platformAdmin,
      tenant,
      can: (slug, permission) => session.platformAdmin || hasPermission(tenant(slug)?.permissions ?? [], permission),
      expired,
      signInAgain: () => signInAgain(),
    }
  }, [session, tenant, expired])

  if (query.error && !(query.error instanceof SessionExpiredError)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p role="alert">Não foi possível carregar a sessão. Recarregue a página.</p>
      </main>
    )
  }
  if (expired && !value) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8">
        <p role="alert">Sua sessão expirou.</p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={() => signInAgain()}
        >
          Entrar de novo
        </button>
      </main>
    )
  }
  if (!value || noAccess) {
    return fallback ?? null
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('useSession fora do SessionProvider')
  }
  return value
}
