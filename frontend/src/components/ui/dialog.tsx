import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Diálogo modal sobre o `<dialog>` nativo (`showModal`): foco preso, `Esc` para fechar e fundo inerte, sem injetar
 * `<style>` (o Dialog do Radix injeta para travar a rolagem, o que a CSP bloqueia; Q-07, DEC-15).
 */
export function Dialog({
  open,
  onOpenChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'dialog'>, 'open'> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      className={cn(
        'm-auto w-full max-w-lg rounded-lg border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/50',
        className,
      )}
      {...props}
    >
      {open && children}
    </dialog>
  )
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-4 flex flex-col gap-2 pr-8', className)} {...props} />
}

export function DialogTitle({ className, children, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2 className={cn('text-lg leading-none font-semibold', className)} {...props}>
      {children}
    </h2>
  )
}

export function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
}

export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Fechar"
      onClick={onClose}
      className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  )
}
