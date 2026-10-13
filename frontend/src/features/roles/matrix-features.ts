import type { listAllFeatures } from '@/features/catalog'

import type { MatrixFeature } from './components/PermissionMatrix'

/** Funcionalidades do catálogo no formato da matriz; desabilitada se ela ou o módulo estiver desabilitado. */
export function toMatrix(features: Awaited<ReturnType<typeof listAllFeatures>>): MatrixFeature[] {
  return features.map((feature) => ({
    code: feature.code ?? '',
    name: feature.name ?? feature.code ?? '',
    module: feature.module ?? (feature.code ?? '').split('.')[0] ?? '',
    moduleName: feature.moduleName,
    category: feature.category ?? undefined,
    enabled: feature.enabled !== false && feature.moduleEnabled,
  }))
}
