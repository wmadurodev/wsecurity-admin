import { Loader2 } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Confirmação de ação destrutiva (RF-NAV-06). Com `requireText`, o botão só habilita depois de digitar exatamente o
 * identificador (confirmação forte: exclusão de tenant e de usuário, rotação de chave).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  requireText,
  pending = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  requireText?: string
  pending?: boolean
  onConfirm: () => void
}) {
  const inputId = useId()
  const [typed, setTyped] = useState('')
  const confirmed = !requireText || typed === requireText

  function change(next: boolean) {
    if (!next) {
      setTyped('')
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={change} aria-labelledby={`${inputId}-titulo`}>
      <DialogClose onClose={() => change(false)} />
      <DialogHeader>
        <DialogTitle id={`${inputId}-titulo`}>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {requireText && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>
            Digite <strong className="font-mono">{requireText}</strong> para confirmar
          </Label>
          <Input id={inputId} value={typed} autoComplete="off" onChange={(event) => setTyped(event.target.value)} />
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => change(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button variant={destructive ? 'destructive' : 'default'} disabled={!confirmed || pending} onClick={onConfirm}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
