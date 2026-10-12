import type { ReactNode } from 'react'

import { useSession } from '@/lib/session-context'

/**
 * Mostra o conteúdo só se o chamador tem a permissão no tenant (RF-NAV-08). É usabilidade: a autoridade é a API (RN-03).
 */
export function PermissionGate({
  tenant,
  permission,
  children,
  fallback = null,
}: {
  tenant: string
  permission: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const { can } = useSession()
  return <>{can(tenant, permission) ? children : fallback}</>
}
