import { authz, idp, type Page } from '@/lib/api/client'
import type { components as AuthzComponents } from '@/lib/api/types/authz'
import type { components } from '@/lib/api/types/idp'

export type Client = components['schemas']['ClientResponse']
export type ClientRequest = components['schemas']['ClientRequest']
export type ClientSecret = components['schemas']['SecretResponse']
export type Scope = components['schemas']['Scope']
export type CreateScope = components['schemas']['CreateScope']
export type UpdateScope = components['schemas']['UpdateScope']
export type IdpKey = components['schemas']['KeyResponse']
export type AuthzKey = AuthzComponents['schemas']['KeyResponse']

/** Chaves de consulta da área. Respostas com segredo nunca entram no cache (RN-05). */
export const clientKeys = {
  all: ['clients'] as const,
  list: (query: Record<string, string | number>) => ['clients', 'list', query] as const,
  detail: (clientId: string) => ['clients', 'detail', clientId] as const,
  secrets: (clientId: string) => ['clients', 'secrets', clientId] as const,
  scopes: ['scopes'] as const,
  keys: (module: 'idp' | 'authz') => ['keys', module] as const,
}

export async function listClients(query: Record<string, string | number>): Promise<Page<Client>> {
  return (await idp.get('/clients', { query })).data as Page<Client>
}

export async function getClient(clientId: string): Promise<Client> {
  return (await idp.get('/clients/{clientId}', { path: { clientId } })).data
}

/** Cria o cliente. O segredo devolvido (confidencial) aparece uma única vez e não é guardado (RN-05). */
export async function createClient(body: ClientRequest): Promise<{ client: Client; secret: string | undefined }> {
  const { data } = await idp.post('/clients', { body })
  return { client: data.client ?? {}, secret: data.clientSecret ?? undefined }
}

/** Substitui a configuração. Se a mudança gerar um segredo (ex.: passou a usar segredo), ele vem uma única vez. */
export async function updateClient(
  clientId: string,
  body: ClientRequest,
): Promise<{ client: Client; secret: string | undefined }> {
  const { data } = await idp.put('/clients/{clientId}', { path: { clientId }, body })
  return { client: data.client ?? {}, secret: data.clientSecret ?? undefined }
}

export async function setClientEnabled(clientId: string, enabled: boolean): Promise<void> {
  if (enabled) {
    await idp.post('/clients/{clientId}/enable', { path: { clientId } })
  } else {
    await idp.post('/clients/{clientId}/disable', { path: { clientId } })
  }
}

export async function listSecrets(clientId: string): Promise<ClientSecret[]> {
  return (await idp.get('/clients/{clientId}/secrets', { path: { clientId } })).data
}

/** Gera um novo segredo; os anteriores valem até `previousSecretsExpireAt` (período de transição). */
export async function rotateSecret(
  clientId: string,
): Promise<{ secret: string; previousExpireAt: string | undefined }> {
  const { data } = await idp.post('/clients/{clientId}/secrets', { path: { clientId } })
  return { secret: data.clientSecret ?? '', previousExpireAt: data.previousSecretsExpireAt ?? undefined }
}

export async function revokeSecret(clientId: string, secretId: string): Promise<void> {
  await idp.delete('/clients/{clientId}/secrets/{secretId}', { path: { clientId, secretId } })
}

export async function listScopes(): Promise<Scope[]> {
  return (await idp.get('/scopes')).data
}

export async function createScope(body: CreateScope): Promise<void> {
  await idp.post('/scopes', { body })
}

export async function updateScope(name: string, body: UpdateScope): Promise<void> {
  await idp.patch('/scopes/{name}', { path: { name }, body })
}

export async function listKeys(module: 'idp' | 'authz'): Promise<(IdpKey | AuthzKey)[]> {
  return module === 'idp' ? (await idp.get('/keys')).data : (await authz.get('/admin/v1/keys')).data
}

export async function rotateKeys(module: 'idp' | 'authz'): Promise<void> {
  if (module === 'idp') {
    await idp.post('/keys/rotate')
  } else {
    await authz.post('/admin/v1/keys/rotate')
  }
}
