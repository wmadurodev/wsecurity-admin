import { AlertCircle, Inbox, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { isApiError } from '@/lib/api/errors'

/** Estado de carregamento (RF-NAV-04). */
export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  )
}

/** Estado vazio com ação sugerida (RF-NAV-04). */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Estado de erro com "tentar de novo" (RF-NAV-04). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const title = isApiError(error) && error.problem.title ? error.problem.title : 'Não foi possível carregar'
  const detail = isApiError(error) ? error.problem.detail : undefined
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-12 text-center">
      <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {detail && <p className="max-w-md text-sm text-muted-foreground">{detail}</p>}
      {isApiError(error) && error.traceId && (
        <p className="text-xs text-muted-foreground">Rastreamento: {error.traceId}</p>
      )}
      {onRetry && (
        <Button variant="outline" className="mt-2" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}
