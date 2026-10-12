import type * as React from 'react'

import { cn } from '@/lib/utils'

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  // eslint-disable-next-line jsx-a11y/label-has-associated-control -- o controle é associado por htmlFor em quem usa
  return <label className={cn('text-sm leading-none font-medium select-none', className)} {...props} />
}
