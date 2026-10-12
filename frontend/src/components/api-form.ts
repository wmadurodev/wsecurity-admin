import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form'

import { isApiError } from '@/lib/api/errors'

import { showProblem } from './problem-toast'

/**
 * Leva os erros por campo da API (`400 validation-failed`) para os campos do formulário (RF-NAV-05). Os demais erros
 * (e campos que o formulário não tem) viram notificação. Devolve `true` se algum campo recebeu erro.
 */
export function applyApiErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown): boolean {
  if (!isApiError(error)) {
    showProblem(error)
    return false
  }
  const known = Object.keys(form.getValues())
  const all = Object.entries(error.fieldErrors)
  const fields = all.filter(([field]) => known.includes(field.split('.')[0] ?? field))
  fields.forEach(([field, message]) => form.setError(field as FieldPath<T>, { type: 'server', message }))
  if (fields.length < all.length || all.length === 0) {
    showProblem(error)
  }
  return fields.length > 0
}
