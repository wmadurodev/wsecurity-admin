import { type ReactNode, useId } from 'react'
import { type Control, Controller, type ControllerRenderProps, type FieldPath, type FieldValues } from 'react-hook-form'

import { Label } from '@/components/ui/label'

export interface FieldProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

/**
 * Campo de formulário (react-hook-form + zod) com rótulo, descrição e o erro do cliente ou da API (RF-NAV-05).
 */
export function FormField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  render,
}: {
  control: Control<T>
  name: N
  label: string
  description?: ReactNode
  render: (field: ControllerRenderProps<T, N>, props: FieldProps) => ReactNode
}) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const describedBy = [description ? `${id}-desc` : undefined, fieldState.error ? `${id}-erro` : undefined]
          .filter(Boolean)
          .join(' ')
        return (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {render(field, {
              id,
              'aria-invalid': Boolean(fieldState.error),
              'aria-describedby': describedBy || undefined,
            })}
            {description && (
              <p id={`${id}-desc`} className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
            {fieldState.error?.message && (
              <p id={`${id}-erro`} role="alert" className="text-xs text-destructive">
                {fieldState.error.message}
              </p>
            )}
          </div>
        )
      }}
    />
  )
}
