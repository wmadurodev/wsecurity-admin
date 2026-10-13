import { env } from './env'

/**
 * Preparação de dados pelas APIs do IdP e da autorização, com o token do cliente administrativo (`make token-admin`).
 * Cada jornada cria os próprios dados com nomes únicos, então nada depende da ordem dos testes nem de reset.
 */

/** Senha inicial dos usuários criados pelos testes, sem partes do nome nem do e-mail (0001/RN-01). */
export const INITIAL_PASSWORD = 'girassol vermelho na janela 2026'
/** Senha definida na troca obrigatória do primeiro acesso. */
export const NEW_PASSWORD = 'trilha serena do cometa 4821'

export interface Persona {
  id: string
  email: string
  name: string
  password: string
}

/** Sufixo único por chamada: minúsculas e dígitos, válido em e-mails, `slug` e códigos de papel. */
export function uniqueId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

async function call<T>(base: string, method: string, path: string, body?: unknown, expected: number[] = [200, 201]) {
  if (!env.adminToken) {
    throw new Error('E2E_ADMIN_TOKEN não definido: rode pelo make e2e-admin do wsecurity-infra.')
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.adminToken}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} → ${response.status}: ${text.slice(0, 300)}`)
  }
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T }
}

/** Usuário do IdP com senha inicial (ou administrador da plataforma, com `wsecurity.admin`). */
export async function createUser(label: string, options: { platformAdmin?: boolean } = {}): Promise<Persona> {
  const id = uniqueId()
  const email = `e2e.${label}.${id}@exemplo.local`
  const name = `E2E ${label} ${id}`
  const created = await call<{ id: string }>(env.idp, 'POST', '/api/admin/v1/users', {
    email,
    name,
    locale: 'pt-BR',
    password: INITIAL_PASSWORD,
    wsecurityAdmin: options.platformAdmin ?? false,
  })
  return { id: created.body.id, email, name, password: INITIAL_PASSWORD }
}

/**
 * Módulo `demo` do catálogo, usado pelas jornadas. É igual ao criado pelo perfil dev da autorização, então a
 * sincronização (idempotente) não altera um ambiente que já o tenha; fora do dev, ela o cria.
 */
export async function ensureDemoModule(): Promise<void> {
  await call(env.authz, 'PUT', '/api/admin/v1/modules/demo', {
    name: 'Demonstração',
    description: 'Módulo de exemplo para desenvolvimento local',
    features: [
      { code: 'demo.orders', name: 'Pedidos', description: 'Pedidos de exemplo', category: 'Vendas' },
      { code: 'demo.reports', name: 'Relatórios', description: 'Relatórios de exemplo', category: 'BI' },
    ],
  })
}

/** Papel global `viewer` (leitura do `demo`, igual ao do perfil dev), criado se ainda não existir. */
export async function ensureViewerRole(): Promise<void> {
  const current = await call(env.authz, 'GET', '/api/admin/v1/roles/viewer', undefined, [200, 404])
  if (current.status === 404) {
    await call(env.authz, 'POST', '/api/admin/v1/roles', {
      code: 'viewer',
      name: 'Leitor',
      description: 'Consulta pedidos e relatórios',
      grants: [
        { feature: 'demo.orders', access: 'READ' },
        { feature: 'demo.reports', access: 'READ' },
      ],
    })
  }
}

/** Tenant com o módulo `demo` e o dono informado. */
export async function createTenant(owner: Persona): Promise<{ slug: string; name: string }> {
  const id = uniqueId()
  const slug = `e2e-${id}`
  const name = `E2E Tenant ${id}`
  await call(env.authz, 'POST', '/api/admin/v1/tenants', {
    slug,
    name,
    plan: 'e2e',
    modules: ['demo'],
    owner: { email: owner.email },
  })
  return { slug, name }
}

export async function createTenantRole(
  slug: string,
  code: string,
  grants: { feature: string; access: 'READ' | 'WRITE' }[],
): Promise<void> {
  await call(env.authz, 'POST', `/api/v1/tenants/${slug}/roles`, { code, name: code, grants })
}

export async function addMember(slug: string, member: Persona, roles: string[]): Promise<void> {
  await call(env.authz, 'POST', `/api/v1/tenants/${slug}/members`, { email: member.email, roles, invite: false })
}
