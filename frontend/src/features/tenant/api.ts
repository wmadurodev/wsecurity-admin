import { authz, type Page } from '@/lib/api/client'
import type { components } from '@/lib/api/types/authz'

export type TenantProfile = components['schemas']['TenantResponse']
export type UpdateTenantProfile = components['schemas']['UpdateTenantProfile']
export type Member = components['schemas']['MemberResponse']
export type AddMember = components['schemas']['AddMember']
export type TenantRole = components['schemas']['RoleResponse']

export const tenantAreaKeys = {
  tenant: (slug: string) => ['tenant', slug, 'profile'] as const,
  members: (slug: string, query: Record<string, string | number>) => ['tenant', slug, 'members', query] as const,
  membersAll: (slug: string) => ['tenant', slug, 'members'] as const,
  member: (slug: string, subject: string) => ['tenant', slug, 'member', subject] as const,
  roles: (slug: string) => ['tenant', slug, 'roles'] as const,
}

const etagOf = (version: number | undefined, etag: string | undefined) =>
  etag ?? (version === undefined ? undefined : `"${version}"`)

export async function getTenantProfile(slug: string): Promise<{ tenant: TenantProfile; etag: string | undefined }> {
  const response = await authz.get('/v1/tenants/{tenant}', { path: { tenant: slug } })
  return { tenant: response.data, etag: etagOf(response.data.version, response.etag) }
}

export async function updateTenantProfile(
  slug: string,
  body: UpdateTenantProfile,
  etag: string | undefined,
): Promise<void> {
  await authz.patch('/v1/tenants/{tenant}', { path: { tenant: slug }, body, ifMatch: etag })
}

export async function listMembers(slug: string, query: Record<string, string | number>): Promise<Page<Member>> {
  return (await authz.get('/v1/tenants/{tenant}/members', { path: { tenant: slug }, query })).data as Page<Member>
}

export async function getMember(slug: string, subject: string): Promise<{ member: Member; etag: string | undefined }> {
  const response = await authz.get('/v1/tenants/{tenant}/members/{subject}', { path: { tenant: slug, subject } })
  return { member: response.data, etag: etagOf(response.data.version, response.etag) }
}

export async function addMember(slug: string, body: AddMember): Promise<Member> {
  return (await authz.post('/v1/tenants/{tenant}/members', { path: { tenant: slug }, body })).data
}

export async function replaceRoles(
  slug: string,
  subject: string,
  roles: string[],
  etag: string | undefined,
): Promise<void> {
  await authz.put('/v1/tenants/{tenant}/members/{subject}/roles', {
    path: { tenant: slug, subject },
    body: { roles },
    ifMatch: etag,
  })
}

/** Define (`expiresAt`) ou remove (`null`) a expiração do vínculo. */
export async function setExpiration(
  slug: string,
  subject: string,
  expiresAt: string | null,
  etag: string | undefined,
): Promise<void> {
  await authz.patch('/v1/tenants/{tenant}/members/{subject}', {
    path: { tenant: slug, subject },
    body: { expiresAt } as { expiresAt?: string },
    ifMatch: etag,
  })
}

export async function setMemberStatus(slug: string, subject: string, action: 'suspend' | 'reactivate'): Promise<void> {
  const path = { tenant: slug, subject }
  if (action === 'suspend') {
    await authz.post('/v1/tenants/{tenant}/members/{subject}/suspend', { path })
  } else {
    await authz.post('/v1/tenants/{tenant}/members/{subject}/reactivate', { path })
  }
}

export async function removeMember(slug: string, subject: string): Promise<void> {
  await authz.delete('/v1/tenants/{tenant}/members/{subject}', { path: { tenant: slug, subject } })
}

export async function listTenantRoles(slug: string): Promise<TenantRole[]> {
  return (await authz.get('/v1/tenants/{tenant}/roles', { path: { tenant: slug } })).data
}
