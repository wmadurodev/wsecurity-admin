import type { SessionValue } from '@/lib/session-context'

import type { TenantRole } from './api'

type Level = 'READ' | 'WRITE'
const rank: Record<Level, number> = { READ: 1, WRITE: 2 }

export const OWNER = 'owner'

/** Permissões efetivas do chamador (`core.members:write` → `core.members: WRITE`). */
export function heldLevels(permissions: readonly string[]): Map<string, Level> {
  const held = new Map<string, Level>()
  for (const permission of permissions) {
    const [feature, access] = permission.split(':')
    const level: Level | undefined = access === 'write' ? 'WRITE' : access === 'read' ? 'READ' : undefined
    const current = feature ? held.get(feature) : undefined
    if (feature && level && (current === undefined || rank[level] > rank[current])) {
      held.set(feature, level)
    }
  }
  return held
}

/** Dono do tenant ou administrador da plataforma: sem os limites do anti-escalonamento (0002/RN-07). */
export function isUnrestricted(session: SessionValue, slug: string): boolean {
  return session.isPlatformAdmin || Boolean(session.tenant(slug)?.roles.includes(OWNER))
}

/**
 * O chamador pode atribuir ou remover o papel (0002/RN-07): sem restrição para dono e plataforma; para os demais, nunca
 * `owner` nem papéis dinâmicos, e só papéis cujas concessões estejam cobertas pelas permissões dele. A API decide.
 */
export function canAssign(session: SessionValue, slug: string, role: TenantRole): boolean {
  if (isUnrestricted(session, slug)) {
    return true
  }
  if (role.code === OWNER || role.dynamic) {
    return false
  }
  const held = heldLevels(session.tenant(slug)?.permissions ?? [])
  return (role.grants ?? []).every((grant) => {
    const has = grant.feature ? held.get(grant.feature) : undefined
    return has !== undefined && grant.access !== undefined && rank[has] >= rank[grant.access]
  })
}
