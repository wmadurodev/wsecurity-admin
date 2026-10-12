import {
  Building2,
  FileClock,
  Home,
  KeyRound,
  LayoutGrid,
  type LucideIcon,
  ScrollText,
  Shield,
  ShieldCheck,
  Tag,
  Users,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Permissão no tenant exigida para ver o item (RF-NAV-01, RF-NAV-08). */
  permission?: string
  end?: boolean
}

/** Seções da área da plataforma (04 §6). */
export const PLATFORM_NAV: NavItem[] = [
  { label: 'Início', to: '/platform', icon: Home, end: true },
  { label: 'Usuários', to: '/platform/users', icon: Users },
  { label: 'Clientes OAuth', to: '/platform/clients', icon: ShieldCheck },
  { label: 'Escopos', to: '/platform/scopes', icon: Tag },
  { label: 'Chaves', to: '/platform/keys', icon: KeyRound },
  { label: 'Módulos', to: '/platform/modules', icon: LayoutGrid },
  { label: 'Papéis globais', to: '/platform/roles', icon: Shield },
  { label: 'Tenants', to: '/platform/tenants', icon: Building2 },
  { label: 'Auditoria', to: '/platform/audit', icon: FileClock },
]

/** Seções da área de um tenant (04 §6), conforme as permissões `core.*` do chamador. */
export function tenantNav(slug: string): NavItem[] {
  const base = `/t/${encodeURIComponent(slug)}`
  return [
    { label: 'Visão geral', to: base, icon: Building2, permission: 'core.tenant:read', end: true },
    { label: 'Membros', to: `${base}/members`, icon: Users, permission: 'core.members:read' },
    { label: 'Papéis', to: `${base}/roles`, icon: Shield, permission: 'core.roles:read' },
    { label: 'Auditoria', to: `${base}/audit`, icon: ScrollText, permission: 'core.audit:read' },
  ]
}

/** Contexto atual a partir da URL: `platform`, o slug do tenant ou nenhum. */
export function contextFromPath(
  pathname: string,
): { kind: 'platform' } | { kind: 'tenant'; slug: string } | { kind: 'none' } {
  if (pathname === '/platform' || pathname.startsWith('/platform/')) {
    return { kind: 'platform' }
  }
  const match = /^\/t\/([^/]+)/.exec(pathname)
  if (match?.[1]) {
    return { kind: 'tenant', slug: decodeURIComponent(match[1]) }
  }
  return { kind: 'none' }
}
