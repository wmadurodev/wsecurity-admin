import type { ReactNode } from 'react'
import { Navigate, Outlet, useParams } from 'react-router'

import { TenantChooserPage } from '@/features/home/TenantChooserPage'
import { useSession } from '@/lib/session-context'

import { ForbiddenPage } from './pages'

/** Página inicial (RF-NAV-03): plataforma, o único tenant ou a escolha entre vários. */
export function HomeRedirect() {
  const { session } = useSession()
  if (session.platformAdmin) {
    return <Navigate to="/platform" replace />
  }
  const [only, ...others] = session.tenants
  if (only && others.length === 0) {
    return <Navigate to={`/t/${encodeURIComponent(only.slug)}`} replace />
  }
  return <TenantChooserPage />
}

/** A área da plataforma exige `wsecurity.admin`. */
export function PlatformGuard() {
  const { isPlatformAdmin } = useSession()
  return isPlatformAdmin ? <Outlet /> : <ForbiddenPage />
}

/** A área de um tenant exige o tenant na sessão (permissão `core.*`) ou administração da plataforma. */
export function TenantGuard() {
  const { slug = '' } = useParams()
  const { tenant, isPlatformAdmin } = useSession()
  return isPlatformAdmin || tenant(slug) ? <Outlet /> : <ForbiddenPage />
}

/** Tela do tenant que exige uma permissão (RF-NAV-08). */
export function RequirePermission({ permission, children }: { permission: string; children?: ReactNode }) {
  const { slug = '' } = useParams()
  const { can } = useSession()
  return can(slug, permission) ? (children ?? <Outlet />) : <ForbiddenPage />
}
