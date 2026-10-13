import { authz, type Page } from '@/lib/api/client'
import type { components } from '@/lib/api/types/authz'

export type Tenant = components['schemas']['TenantResponse']
export type TenantStatus = NonNullable<Tenant['status']>
export type CreateTenant = components['schemas']['CreateTenant']
export type UpdateTenant = components['schemas']['UpdateTenant']
export type TenantModule = components['schemas']['TenantModuleResponse']

/** `slug` de tenant (0002/RN-09): 3 a 63 caracteres, minúsculas, números e hífen, sem hífen nas pontas. */
export const SLUG = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/

/** Sugestão de `slug` a partir do nome: sem acentos, minúsculas, hífens no lugar do resto. */
export function suggestSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '')
}

export const tenantKeys = {
  all: ['tenants'] as const,
  list: (query: Record<string, string | number>) => ['tenants', 'list', query] as const,
  detail: (slug: string) => ['tenants', 'detail', slug] as const,
  modules: (slug: string) => ['tenants', 'modules', slug] as const,
}

export async function listTenants(query: Record<string, string | number>): Promise<Page<Tenant>> {
  return (await authz.get('/admin/v1/tenants', { query })).data as Page<Tenant>
}

export async function getTenant(slug: string): Promise<{ tenant: Tenant; etag: string | undefined }> {
  const response = await authz.get('/admin/v1/tenants/{tenant}', { path: { tenant: slug } })
  return { tenant: response.data, etag: response.etag }
}

export async function createTenant(body: CreateTenant): Promise<Tenant> {
  return (await authz.post('/admin/v1/tenants', { body })).data
}

export async function updateTenant(slug: string, body: UpdateTenant, etag: string | undefined): Promise<Tenant> {
  return (await authz.patch('/admin/v1/tenants/{tenant}', { path: { tenant: slug }, body, ifMatch: etag })).data
}

export async function setTenantStatus(slug: string, action: 'suspend' | 'activate'): Promise<void> {
  if (action === 'suspend') {
    await authz.post('/admin/v1/tenants/{tenant}/suspend', { path: { tenant: slug } })
  } else {
    await authz.post('/admin/v1/tenants/{tenant}/activate', { path: { tenant: slug } })
  }
}

export async function deleteTenant(slug: string): Promise<void> {
  await authz.delete('/admin/v1/tenants/{tenant}', { path: { tenant: slug } })
}

export async function listTenantModules(slug: string): Promise<TenantModule[]> {
  return (await authz.get('/admin/v1/tenants/{tenant}/modules', { path: { tenant: slug } })).data
}

export async function enableModule(slug: string, module: string): Promise<void> {
  await authz.put('/admin/v1/tenants/{tenant}/modules/{module}', { path: { tenant: slug, module } })
}

export async function disableModule(slug: string, module: string): Promise<void> {
  await authz.delete('/admin/v1/tenants/{tenant}/modules/{module}', { path: { tenant: slug, module } })
}
