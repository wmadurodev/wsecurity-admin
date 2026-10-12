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
}
