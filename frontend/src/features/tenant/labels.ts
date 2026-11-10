import type { Member } from './api'

export const MEMBER_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'SUSPENDED', label: 'Suspenso' },
] as const

export const SUBJECT_TYPE_OPTIONS = [
  { value: 'USER', label: 'Usuário' },
  { value: 'CLIENT', label: 'Cliente (serviço)' },
] as const

export function subjectTypeLabel(type: Member['subjectType']): string {
  return SUBJECT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? '—'
}

/** O vínculo venceu: a API o mantém, mas ele não concede permissões. */
export function isExpired(member: Member, now = Date.now()): boolean {
  return Boolean(member.expiresAt && new Date(member.expiresAt).getTime() <= now)
}

/** `datetime-local` (fuso do navegador) ↔ ISO-8601. */
export const toIso = (local: string) => (local ? new Date(local).toISOString() : null)
export function toLocalInput(iso: string | undefined): string {
  if (!iso) {
    return ''
  }
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

/** `409`/`422` do último dono (0002/RN-06). */
export const isLastOwner = (type: string | undefined) => Boolean(type?.endsWith('/tenant-last-owner'))
export const LAST_OWNER_HELP =
  'Todo tenant precisa de pelo menos um dono ativo. Atribua o papel owner a outro membro antes de rebaixar, suspender ou remover este.'

/** `sub` abreviado: os 8 primeiros caracteres. */
export const shortSubject = (subject: string) => (subject.length > 12 ? `${subject.slice(0, 8)}…` : subject)

/** Origem do papel (RF-ROL-02). */
export const ROLE_ORIGIN: Record<string, string> = { SYSTEM: 'sistema', GLOBAL: 'global', TENANT: 'do tenant' }

/** `403` do anti-escalonamento (0002/RN-07): a API responde com o tipo `privilege-escalation`. */
export const isPrivilegeEscalation = (type: string | undefined) => Boolean(type?.endsWith('/privilege-escalation'))

/** Aviso da conta excluída cujos dados já foram anonimizados (fase 0010, RF-STA-10). */
export const ANONYMIZED_NOTICE = 'Dados pessoais removidos após a exclusão'

/** Avisos quando o nome e o e-mail do membro não vieram do IdP (fase 0008, RF-PRF-04). */
export const PROFILE_NOTICE: Record<string, string> = {
  NOT_FOUND: 'Usuário não encontrado no IdP',
  UNAVAILABLE: 'Dados do IdP indisponíveis no momento',
}

type AccountFields = Pick<Member, 'accountStatus' | 'accountDeletedBy'>

/** A conta do membro foi desativada ou excluída no IdP (fase 0010, RF-STA-10): sem acesso e sem ações locais. */
export const isAccountInactive = (member: AccountFields) =>
  member.accountStatus === 'DISABLED' || member.accountStatus === 'DELETED'

/** Selo da situação da conta, no lugar do status do vínculo (04 §6). */
export function accountStatusLabel(member: AccountFields): string | undefined {
  if (member.accountStatus === 'DISABLED') {
    return 'Desativado pela plataforma'
  }
  if (member.accountStatus === 'DELETED') {
    return member.accountDeletedBy === 'USER' ? 'Conta excluída pelo usuário' : 'Excluído pela plataforma'
  }
  return undefined
}

/** Aviso do detalhe do membro com a conta inativa (04 §6). */
export function accountNotice(member: AccountFields): string | undefined {
  const rest = 'Ela não tem acesso a este tenant e nenhuma ação está disponível aqui.'
  if (member.accountStatus === 'DISABLED') {
    return `A conta desta pessoa foi desativada pelo administrador da plataforma. ${rest}`
  }
  if (member.accountStatus === 'DELETED') {
    return member.accountDeletedBy === 'USER'
      ? `A própria pessoa excluiu a conta. ${rest}`
      : `A conta desta pessoa foi excluída pelo administrador da plataforma. ${rest}`
  }
  return undefined
}

export const PLATFORM_ACCOUNT_NOTICE =
  'Como administrador da plataforma, você ainda pode alterar ou remover este vínculo.'

/** `409` das escritas sobre conta inativa (fase 0010, RF-STA-09). */
export const isAccountInactiveError = (type: string | undefined) => Boolean(type?.endsWith('/member-account-inactive'))

/** Nome e e-mail do membro, quando a API de membros os trouxe (`profileStatus = AVAILABLE`). */
export function memberProfile(member: Pick<Member, 'profileStatus' | 'name' | 'email'>) {
  if (member.profileStatus !== 'AVAILABLE' || !member.email) {
    return undefined
  }
  return { name: member.name ?? undefined, email: member.email }
}
