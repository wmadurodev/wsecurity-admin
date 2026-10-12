import type { Session } from '@/lib/session'

export const adminSession: Session = {
  sub: 'c0ffee00-0000-4000-8000-000000000001',
  name: 'Ana Admin',
  email: 'ana@exemplo.com',
  platformAdmin: true,
  mfa: false,
  expiresAt: '2026-10-12T23:30:00Z',
  tenants: [{ slug: 'acme', name: 'Acme', roles: ['owner'], permissions: ['core.members:write'] }],
  tenantsAvailable: true,
  accountUrl: 'http://localhost:9000/account',
}

/** Dono de um só tenant, sem administração da plataforma. */
export const ownerSession: Session = {
  ...adminSession,
  name: 'Otávio Dono',
  email: 'otavio@exemplo.com',
  platformAdmin: false,
  tenants: [
    {
      slug: 'padaria',
      name: 'Padaria',
      roles: ['owner'],
      permissions: ['core.tenant:write', 'core.members:write', 'core.roles:write', 'core.audit:read'],
    },
  ],
}

/** Administrador limitado: só lê membros (jornada 3 de 04 §6.1). */
export const limitedSession: Session = {
  ...ownerSession,
  tenants: [{ slug: 'padaria', name: 'Padaria', roles: ['leitor'], permissions: ['core.members:read'] }],
}
