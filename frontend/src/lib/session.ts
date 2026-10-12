import { CSRF_HEADER, csrfToken } from './csrf'

/** Tenant em que o usuário tem alguma permissão `core.*` (RF-AUT-03). */
export interface SessionTenant {
  slug: string
  name: string
  roles: string[]
  permissions: string[]
}

/** Resposta de `GET /bff/session`. Nunca contém tokens (RN-01). */
export interface Session {
  sub: string
  name: string | null
  email: string | null
  platformAdmin: boolean
  mfa: boolean
  expiresAt: string
  tenants: SessionTenant[]
  tenantsAvailable: boolean
  /** Área "minha conta" do IdP, para ativar o segundo fator (RF-AUT-08). */
  accountUrl: string
}

/** A sessão do console terminou ou não existe (`401`). */
export class SessionExpiredError extends Error {
  constructor() {
    super('Sua sessão expirou')
    this.name = 'SessionExpiredError'
  }
}

export async function fetchSession(): Promise<Session> {
  const response = await fetch('/bff/session', {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  })
  if (response.status === 401) {
    throw new SessionExpiredError()
  }
  if (!response.ok) {
    throw new Error(`Falha ao carregar a sessão (HTTP ${response.status})`)
  }
  return (await response.json()) as Session
}

/** Sem administração da plataforma nem tenants administráveis: a página `/no-access` do BFF (RF-AUT-07). */
export function hasAdministrativeAccess(session: Session): boolean {
  return session.platformAdmin || session.tenants.length > 0 || !session.tenantsAvailable
}

/**
 * Logout (RF-AUT-06): `POST /bff/logout` com o cabeçalho CSRF. O BFF revoga os tokens, encerra a sessão e responde
 * com o endereço do logout do IdP, para onde o navegador segue.
 */
export async function logout(navigate: (url: string) => void = (url) => window.location.assign(url)): Promise<void> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = csrfToken()
  if (token) {
    headers[CSRF_HEADER] = token
  }
  const response = await fetch('/bff/logout', { method: 'POST', headers, credentials: 'same-origin' })
  if (response.status === 401) {
    navigate('/')
    return
  }
  if (!response.ok) {
    throw new Error(`Falha ao sair (HTTP ${response.status})`)
  }
  const { redirectUrl } = (await response.json()) as { redirectUrl: string }
  navigate(redirectUrl)
}

/** Início do login no BFF (registro com `wsecurity.admin`, com recuo automático para usuários comuns, DEC-03). */
export const LOGIN_URL = '/oauth2/authorization/wsecurity'

/**
 * Entra de novo depois de um `401`. Servida pelo BFF, a página exige sessão: recarregar leva ao login e volta para a
 * mesma tela. No Vite (desenvolvimento) a página não passa pelo BFF, então o login começa direto.
 */
export function signInAgain(dev: boolean = import.meta.env.DEV): void {
  if (dev) {
    window.location.assign(LOGIN_URL)
  } else {
    // A página exige sessão no BFF: ele guarda a rota atual, faz o login e volta para ela.
    window.location.reload()
  }
}

/** Permissão `<funcionalidade>:read|write` (0002). `write` inclui `read`. */
export function hasPermission(granted: readonly string[], permission: string): boolean {
  if (granted.includes(permission)) {
    return true
  }
  const [feature, access] = permission.split(':')
  return access === 'read' && granted.includes(`${feature}:write`)
}
