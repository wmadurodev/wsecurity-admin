import { useQuery } from '@tanstack/react-query'

import { catalogKeys, listAllFeatures } from '@/features/catalog'
import { type MatrixFeature, type RoleMatrixSource, toMatrix } from '@/features/roles'
import { useSession } from '@/lib/session-context'

import { getTenantProfile, listTenantRoles, type TenantRole, tenantAreaKeys } from './api'
import { grantChecker, isUnrestricted } from './permissions'

const moduleOf = (feature: string) => feature.split('.')[0] ?? feature

/** Funcionalidade conhecida só pelo código (sem acesso ao catálogo): o módulo é o prefixo. */
function byCode(code: string): MatrixFeature {
  return { code, name: code, module: moduleOf(code), moduleName: moduleOf(code), enabled: true }
}

/**
 * Funcionalidades da matriz para quem não é administrador da plataforma, que não lê o catálogo (Q-09): as permissões
 * do chamador mais as concessões dos papéis disponíveis ao tenant. Com os módulos contratados conhecidos, só as deles.
 */
export function featuresFromTenant(
  permissions: readonly string[],
  roles: readonly TenantRole[],
  modules: readonly string[] | undefined,
): MatrixFeature[] {
  const codes = new Set<string>()
  for (const permission of permissions) {
    codes.add(permission.split(':')[0] ?? permission)
  }
  for (const role of roles) {
    for (const grant of role.grants ?? []) {
      if (grant.feature) {
        codes.add(grant.feature)
      }
    }
  }
  return [...codes].filter((code) => !modules || modules.includes(moduleOf(code))).map(byCode)
}

/** Acrescenta as funcionalidades de `grants` que faltam na lista, para um papel só de leitura mostrar tudo o que concede. */
export function withGrantedFeatures(features: MatrixFeature[], grants: TenantRole['grants']): MatrixFeature[] {
  const known = new Set(features.map((feature) => feature.code))
  const missing = (grants ?? []).flatMap((grant) =>
    grant.feature && !known.has(grant.feature) ? [byCode(grant.feature)] : [],
  )
  return missing.length ? [...features, ...missing] : features
}

/**
 * Matriz de um papel do tenant (RF-ROL-03): só as funcionalidades dos módulos contratados e `canGrant` pelo
 * anti-escalonamento (0002/RN-07). A plataforma usa o catálogo; os demais, {@link featuresFromTenant}.
 */
export function useTenantMatrix(slug: string): RoleMatrixSource {
  const session = useSession()
  const platform = session.isPlatformAdmin
  const profile = useQuery({
    queryKey: tenantAreaKeys.tenant(slug),
    queryFn: () => getTenantProfile(slug),
    retry: false,
  })
  const catalog = useQuery({ queryKey: catalogKeys.allFeatures, queryFn: listAllFeatures, enabled: platform })
  const roles = useQuery({
    queryKey: tenantAreaKeys.roles(slug),
    queryFn: () => listTenantRoles(slug),
    enabled: !platform,
  })
  // Sem acesso aos dados do tenant (sem core.tenant:read) a lista não é filtrada pelos módulos: a API recusa o resto.
  const modules = profile.data?.tenant.modules
  const profileSettled = profile.isSuccess || profile.isError
  const source = platform ? catalog : roles

  let features: MatrixFeature[] | undefined
  if (profileSettled && platform && catalog.data) {
    features = toMatrix(catalog.data).filter((feature) => !modules || modules.includes(feature.module))
  } else if (profileSettled && !platform && roles.data) {
    features = featuresFromTenant(session.tenant(slug)?.permissions ?? [], roles.data, modules)
  }
  return {
    features,
    pending: !features && !source.isError,
    error: source.error,
    onRetry: () => void source.refetch(),
    canGrant: grantChecker(session, slug),
    deniedHint: isUnrestricted(session, slug)
      ? undefined
      : 'Você não tem esta permissão: só concede ou retira o que possui (anti-escalonamento).',
  }
}
