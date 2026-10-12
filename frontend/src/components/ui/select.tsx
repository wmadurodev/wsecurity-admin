import type * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Select nativo com o visual do shadcn. O Select do Radix trava a rolagem injetando `<style>`, o que a CSP sem
 * `unsafe-inline` bloqueia (Q-07, DEC-15); o nativo é acessível por padrão.
 */
export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}
