import { toast } from 'sonner'

import { isApiError } from '@/lib/api/errors'

/** Notificação de erro com `title`, `detail` e `traceId` do Problem Details (RF-NAV-05). */
export function showProblem(error: unknown, fallbackTitle = 'Não foi possível concluir a operação'): void {
  if (!isApiError(error)) {
    toast.error(fallbackTitle)
    return
  }
  const title = error.isForbidden ? (error.problem.title ?? 'Acesso negado') : (error.problem.title ?? fallbackTitle)
  const lines = [
    error.problem.detail,
    ...error.violations,
    error.traceId ? `Rastreamento: ${error.traceId}` : undefined,
  ]
  toast.error(title, { description: lines.filter(Boolean).join('\n') || undefined })
}

/** Resultado de uma ação (RF-NAV-06). */
export function showSuccess(message: string): void {
  toast.success(message)
}
