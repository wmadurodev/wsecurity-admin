import { authz, type Page } from '@/lib/api/client'
import type { components } from '@/lib/api/types/authz'

export type Module = components['schemas']['ModuleResponse']
export type CreateModule = components['schemas']['CreateModule']
export type UpdateModule = components['schemas']['UpdateModule']
export type Feature = components['schemas']['FeatureResponse']
export type CreateFeature = components['schemas']['CreateFeature']
export type UpdateFeature = components['schemas']['UpdateFeature']

/** Formatos do catálogo na autorização (0002/RN-09). */
export const MODULE_CODE = /^[a-z][a-z0-9-]{1,30}$/
export const FEATURE_NAME = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/

export const catalogKeys = {
  all: ['catalog'] as const,
  modules: (query: Record<string, string | number>) => ['catalog', 'modules', query] as const,
  module: (code: string) => ['catalog', 'module', code] as const,
  features: (code: string) => ['catalog', 'features', code] as const,
  allFeatures: ['catalog', 'all-features'] as const,
}

export async function listModules(query: Record<string, string | number>): Promise<Page<Module>> {
  return (await authz.get('/admin/v1/modules', { query })).data as Page<Module>
}

export async function getModule(code: string): Promise<Module> {
  return (await authz.get('/admin/v1/modules/{module}', { path: { module: code } })).data
}

export async function createModule(body: CreateModule): Promise<Module> {
  return (await authz.post('/admin/v1/modules', { body })).data
}

export async function updateModule(code: string, body: UpdateModule): Promise<Module> {
  return (await authz.patch('/admin/v1/modules/{module}', { path: { module: code }, body })).data
}

export async function deleteModule(code: string): Promise<void> {
  await authz.delete('/admin/v1/modules/{module}', { path: { module: code } })
}

export async function listFeatures(code: string): Promise<Feature[]> {
  return (await authz.get('/admin/v1/modules/{module}/features', { path: { module: code } })).data
}

export async function createFeature(module: string, body: CreateFeature): Promise<Feature> {
  return (await authz.post('/admin/v1/modules/{module}/features', { path: { module }, body })).data
}

export async function updateFeature(module: string, feature: string, body: UpdateFeature): Promise<Feature> {
  return (await authz.patch('/admin/v1/modules/{module}/features/{feature}', { path: { module, feature }, body })).data
}

export async function deleteFeature(module: string, feature: string): Promise<void> {
  await authz.delete('/admin/v1/modules/{module}/features/{feature}', { path: { module, feature } })
}

/** Todas as funcionalidades de todos os módulos, com o nome do módulo (para a matriz de papéis globais). */
export async function listAllFeatures(): Promise<(Feature & { moduleName: string; moduleEnabled: boolean })[]> {
  const modules: Module[] = []
  for (let page = 0, total = 1; page < total; page += 1) {
    const result = await listModules({ page, size: 100, sort: 'code,asc' })
    modules.push(...result.content)
    total = result.totalPages
  }
  const features = await Promise.all(
    modules.map(async (module) =>
      (await listFeatures(module.code ?? '')).map((feature) => ({
        ...feature,
        moduleName: module.name ?? module.code ?? '',
        moduleEnabled: module.enabled !== false,
      })),
    ),
  )
  return features.flat()
}
