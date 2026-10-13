import { authz } from '@/lib/api/client'
import type { components } from '@/lib/api/types/authz'

import type { Grant } from './components/PermissionMatrix'

export type Role = components['schemas']['RoleResponse']
export type CreateRole = components['schemas']['CreateRole']
export type UpdateRole = components['schemas']['UpdateRole']

/** Formato de código de papel (0002). */
export const ROLE_CODE = /^[a-z][a-z0-9-]{1,49}$/

export const roleKeys = {
  global: ['roles', 'global'] as const,
  globalRole: (code: string) => ['roles', 'global', code] as const,
}

export async function listGlobalRoles(): Promise<Role[]> {
  return (await authz.get('/admin/v1/roles')).data
}

export async function getGlobalRole(code: string): Promise<{ role: Role; etag: string | undefined }> {
  const response = await authz.get('/admin/v1/roles/{code}', { path: { code } })
  return { role: response.data, etag: response.etag }
}

export async function createGlobalRole(body: CreateRole): Promise<Role> {
  return (await authz.post('/admin/v1/roles', { body })).data
}

export async function updateGlobalRole(code: string, body: UpdateRole, etag: string | undefined): Promise<Role> {
  return (await authz.put('/admin/v1/roles/{code}', { path: { code }, body, ifMatch: etag })).data
}

export async function deleteGlobalRole(code: string): Promise<void> {
  await authz.delete('/admin/v1/roles/{code}', { path: { code } })
}

export function grantsOf(role: Role | undefined): Grant[] {
  return (role?.grants ?? []).flatMap((grant) =>
    grant.feature && grant.access ? [{ feature: grant.feature, access: grant.access }] : [],
  )
}
