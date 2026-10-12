import { RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ApiError } from '@/lib/api/errors'

/** `409`/`412`: outra pessoa alterou o registro, ou ele já existe. Oferece recarregar (RF-NAV-05, RF-NAV-07). */
export function ConflictNotice({ error, onReload }: { error: ApiError; onReload: () => void }) {
  const stale = error.status === 412
  return (
    <Alert variant="warning">
      <AlertTitle>
        {stale ? 'Este registro foi alterado por outra pessoa' : (error.problem.title ?? 'Conflito')}
      </AlertTitle>
      <AlertDescription>
        <p>
          {stale
            ? 'Recarregue para ver a versão atual antes de salvar de novo. Suas alterações não foram aplicadas.'
            : (error.problem.detail ?? 'A operação conflita com o estado atual do registro.')}
        </p>
        <Button variant="outline" size="sm" onClick={onReload}>
          <RefreshCw aria-hidden="true" />
          Recarregar
        </Button>
      </AlertDescription>
    </Alert>
  )
}
