import type { UserEvent, UserStatus } from './api'

export const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'PENDING_VERIFICATION', label: 'Aguardando verificação' },
  { value: 'DISABLED', label: 'Desativado' },
  { value: 'DELETED', label: 'Excluído' },
]

const EVENTS: Partial<Record<NonNullable<UserEvent['type']>, string>> = {
  LOGIN_SUCCESS: 'Login',
  LOGIN_FAILURE: 'Falha de login',
  ACCOUNT_LOCKED: 'Conta bloqueada',
  ACCOUNT_UNLOCKED: 'Conta desbloqueada',
  LOGOUT: 'Logout',
  TOKEN_ISSUED: 'Token emitido',
  TOKEN_REFRESHED: 'Token renovado',
  TOKEN_REVOKED: 'Token revogado',
  REFRESH_TOKEN_REUSE_DETECTED: 'Reuso de refresh token',
  PASSWORD_CHANGED: 'Senha alterada',
  PASSWORD_RESET_REQUESTED: 'Redefinição de senha pedida',
  PASSWORD_RESET_COMPLETED: 'Senha redefinida',
  EMAIL_VERIFIED: 'E-mail verificado',
  USER_CREATED: 'Usuário criado',
  USER_UPDATED: 'Usuário alterado',
  USER_DISABLED: 'Usuário desativado',
  USER_DELETED: 'Usuário excluído',
  MFA_ENABLED: 'MFA ativado',
  MFA_DISABLED: 'MFA removido',
}

export function eventLabel(type: UserEvent['type']): string {
  return (type && EVENTS[type]) ?? type ?? '—'
}

/** Permissões agrupadas por módulo (`demo.orders:write` → módulo `demo`), para a aba de acessos (RF-USR-06). */
export function groupByModule(permissions: readonly string[]): [string, string[]][] {
  const groups = new Map<string, string[]>()
  for (const permission of [...permissions].sort()) {
    const module = permission.split('.')[0] ?? permission
    groups.set(module, [...(groups.get(module) ?? []), permission])
  }
  return [...groups.entries()]
}

const PASSWORD_POLICY: Record<string, string> = {
  'too-short': 'A senha deve ter pelo menos 12 caracteres.',
  'too-long': 'A senha deve ter no máximo 128 caracteres.',
  'contains-email': 'A senha não pode conter o e-mail.',
  'contains-name': 'A senha não pode conter o nome.',
  common: 'Esta senha é muito comum ou já apareceu em vazamentos. Escolha outra.',
  reused: 'A senha não pode ser igual a uma das senhas recentes.',
}

/** Violações da política de senha do IdP (0001/RN-01) em pt-BR. */
export function passwordPolicyMessage(violations: readonly string[]): string {
  return violations.map((code) => PASSWORD_POLICY[code] ?? code).join(' ')
}
