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
