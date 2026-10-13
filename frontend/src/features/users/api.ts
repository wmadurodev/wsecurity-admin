import type { Page } from '@/lib/api/client'
import { idp, request } from '@/lib/api/client'
import type { components } from '@/lib/api/types/idp'

export type User = components['schemas']['UserResponse']
export type UserStatus = NonNullable<User['status']>
export type CreateUser = components['schemas']['CreateUser']
export type UpdateUser = components['schemas']['UpdateUser']
export type UserEvent = components['schemas']['AuditEventResponse']

/** Acessos de um usuário nos tenants (RF-BFF-03). */
export interface UserAccess {
  sub: string
  tenants: { slug: string; name: string; roles: string[]; permissions: string[] }[]
}

/** Chaves de consulta da área de usuários. */
export const userKeys = {
  all: ['users'] as const,
  list: (query: Record<string, string | number>) => ['users', 'list', query] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
  events: (id: string, query: Record<string, string | number>) => ['users', 'events', id, query] as const,
  access: (id: string) => ['users', 'access', id] as const,
}

export async function listUsers(query: Record<string, string | number>): Promise<Page<User>> {
  return (await idp.get('/users', { query })).data as Page<User>
}

/** Usuário e a versão lida (`ETag`), para o `If-Match` da edição (RF-NAV-07). */
export async function getUser(id: string): Promise<{ user: User; etag: string | undefined }> {
  const response = await idp.get('/users/{id}', { path: { id } })
  return { user: response.data, etag: response.etag }
}

export async function createUser(body: CreateUser): Promise<User> {
  return (await idp.post('/users', { body })).data
}

export async function updateUser(id: string, body: UpdateUser, etag: string | undefined): Promise<User> {
  return (await idp.patch('/users/{id}', { path: { id }, body, ifMatch: etag })).data
}

export type UserAction = 'disable' | 'enable' | 'unlock' | 'password-reset' | 'mfa-reset' | 'delete'

export async function runUserAction(id: string, action: UserAction): Promise<void> {
  const path = { id }
  switch (action) {
    case 'disable':
      await idp.post('/users/{id}/disable', { path })
      return
    case 'enable':
      await idp.post('/users/{id}/enable', { path })
      return
    case 'unlock':
      await idp.post('/users/{id}/unlock', { path })
      return
    case 'password-reset':
      await idp.post('/users/{id}/password-reset', { path })
      return
    case 'mfa-reset':
      await idp.post('/users/{id}/mfa/reset', { path })
      return
    case 'delete':
      await idp.delete('/users/{id}', { path })
  }
}

export async function listUserEvents(id: string, query: Record<string, string | number>): Promise<Page<UserEvent>> {
  return (await idp.get('/users/{id}/events', { path: { id }, query })).data as Page<UserEvent>
}

export async function getUserAccess(id: string): Promise<UserAccess> {
  return (await request<UserAccess>('get', `/bff/users/${encodeURIComponent(id)}/access`)).data
}
