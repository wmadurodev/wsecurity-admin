import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Campo de senha com o botão de mostrar/ocultar (0006/RF-SEN-06). Começa oculto a cada montagem; repassa `ref` e as
 * demais props ao `Input`, para funcionar com o `FormField` como um campo comum.
 */
export function PasswordInput({ className, id, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  const label = visible ? 'Ocultar senha' : 'Mostrar senha'
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} id={id} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label={label}
        aria-pressed={visible}
        aria-controls={id}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}
