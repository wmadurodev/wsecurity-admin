import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { User } from '@/features/users'

import { shortSubject } from './labels'

/** `sub` abreviado com o botão "copiar" (Q-03). */
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

/** Nome e e-mail do IdP para o administrador da plataforma; para os demais, só o `sub` (Q-03). */
export function MemberIdentity({ subject, user }: { subject: string; user: User | undefined }) {
  if (!user) {
    return <CopySubject subject={subject} />
  }
  return (
    <span className="flex flex-col">
      <span className="font-medium">{user.name ?? user.email}</span>
      <span className="text-xs text-muted-foreground">{user.email}</span>
    </span>
  )
}
