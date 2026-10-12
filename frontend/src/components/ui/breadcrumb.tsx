import { ChevronRight } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

export function Breadcrumb(props: React.ComponentProps<'nav'>) {
  return <nav aria-label="Trilha" {...props} />
}

export function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      className={cn('flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground', className)}
      {...props}
    />
  )
}

export function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />
}

export function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return <span aria-current="page" className={cn('font-normal text-foreground', className)} {...props} />
}

export function BreadcrumbSeparator() {
  return (
    <li role="presentation" aria-hidden="true">
      <ChevronRight className="size-3.5" />
    </li>
  )
}
