import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

import type { Member } from './api'
import { memberProfile, PROFILE_NOTICE, shortSubject } from './labels'

/** `sub` abreviado com o botão "copiar". */
export function CopySubject({ subject }: { subject: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(subject)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <span className="inline-flex items-center gap-1">
      <code className="text-xs" title={subject}>
        {shortSubject(subject)}
      </code>
      <Button variant="ghost" size="icon" className="size-6" aria-label={`Copiar ${subject}`} onClick={copy}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
    </span>
  )
}

/** Aviso quando o nome e o e-mail do membro não vieram do IdP (`NOT_FOUND`, `UNAVAILABLE`). */
export function ProfileNotice({ member }: { member: Pick<Member, 'profileStatus'> }) {
  const notice = member.profileStatus ? PROFILE_NOTICE[member.profileStatus] : undefined
  return notice ? <span className="text-xs text-muted-foreground">{notice}</span> : null
}

/**
 * Identificação do membro (fase 0008, RF-PRF-04): nome e e-mail vindos da API de membros, para qualquer perfil; sem
 * eles, o `sub` (ou o `client_id` da conta de serviço) com "copiar" e, se for o caso, o aviso.
 */
export function MemberIdentity({ member }: { member: Pick<Member, 'subject' | 'profileStatus' | 'name' | 'email'> }) {
  const profile = memberProfile(member)
  if (profile) {
    return (
      <span className="flex flex-col">
        <span className="font-medium">{profile.name ?? profile.email}</span>
        <span className="text-xs text-muted-foreground">{profile.email}</span>
      </span>
    )
  }
  return (
    <span className="flex flex-col">
      <CopySubject subject={member.subject ?? ''} />
      <ProfileNotice member={member} />
    </span>
  )
}
