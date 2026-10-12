import type * as React from 'react'

import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col gap-4 rounded-xl border bg-card py-5 text-card-foreground', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 px-5', className)} {...props} />
}

export function CardTitle({ className, children, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2 className={cn('leading-none font-semibold', className)} {...props}>
      {children}
    </h2>
  )
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-5', className)} {...props} />
}
