import { CopyOnceSecret } from '@/components/copy-once-secret'
import { DateTime } from '@/components/date-time'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Segredo exibido uma única vez (RN-05, RF-CLI-02): o diálogo não fecha por `Esc` nem por clique fora; só depois de
 * "Já guardei". O valor vive apenas no estado de quem abre o diálogo, que o descarta em `onDone`.
 */
export function SecretDialog({
  clientId,
  secret,
  previousExpireAt,
  onDone,
}: {
  clientId: string
  secret: string
  previousExpireAt?: string
  onDone: () => void
}) {
  return (
    <Dialog open dismissible={false} onOpenChange={() => undefined} aria-labelledby="segredo-titulo">
      <DialogHeader>
        <DialogTitle id="segredo-titulo">Segredo do cliente {clientId}</DialogTitle>
        <DialogDescription>
          {previousExpireAt ? (
            <>
              Os segredos anteriores continuam válidos até <DateTime value={previousExpireAt} /> (período de transição),
              para dar tempo de trocar a configuração da aplicação.
            </>
          ) : (
            'Configure a aplicação com este segredo.'
          )}
        </DialogDescription>
      </DialogHeader>
      <CopyOnceSecret label="Segredo gerado" secret={secret} onDone={onDone} />
    </Dialog>
  )
}
