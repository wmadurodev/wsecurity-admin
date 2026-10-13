import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DateTime } from '@/components/date-time'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { type ClientSecret, clientKeys, listSecrets, revokeSecret, rotateSecret } from './api'
import { SecretDialog } from './SecretDialog'

/** Segredos do cliente confidencial (RF-CLI-05): metadados, geração (exibida uma vez) e revogação. */
export function ClientSecretsTab({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient()
  const secrets = useQuery({ queryKey: clientKeys.secrets(clientId), queryFn: () => listSecrets(clientId) })
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [generated, setGenerated] = useState<{ secret: string; previousExpireAt?: string } | null>(null)
  const [revoking, setRevoking] = useState<ClientSecret | null>(null)

  const revoke = useMutation({
    mutationFn: (secretId: string) => revokeSecret(clientId, secretId),
    onSuccess: async () => {
      setRevoking(null)
      showSuccess('Segredo revogado.')
      await queryClient.invalidateQueries({ queryKey: clientKeys.secrets(clientId) })
    },
    onError: (error) => {
      setRevoking(null)
      showProblem(error)
    },
  })

  // Sem useMutation: a resposta com o segredo não pode ficar no cache de mutações (RN-05).
  async function rotate() {
    setRotating(true)
    try {
      const result = await rotateSecret(clientId)
      setConfirmRotate(false)
      setGenerated({ secret: result.secret, previousExpireAt: result.previousExpireAt })
      await queryClient.invalidateQueries({ queryKey: clientKeys.secrets(clientId) })
    } catch (error) {
      setConfirmRotate(false)
      showProblem(error)
    } finally {
      setRotating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setConfirmRotate(true)}>
          <KeyRound aria-hidden="true" />
          Gerar novo segredo
        </Button>
      </div>
      {secrets.isPending && <LoadingState />}
      {secrets.isError && <ErrorState error={secrets.error} onRetry={() => void secrets.refetch()} />}
      {secrets.data?.length === 0 && <EmptyState title="Nenhum segredo" />}
      {secrets.data && secrets.data.length > 0 && (
        <Table>
          <TableCaption className="sr-only">Segredos do cliente</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Criado em</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...secrets.data]
              .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
              .map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell>
                    <DateTime value={secret.createdAt} />
                  </TableCell>
                  <TableCell>
                    <DateTime value={secret.expiresAt} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={secret.active ? 'ACTIVE' : 'REVOKED'} />
                  </TableCell>
                  <TableCell className="text-right">
                    {secret.active && (
                      <Button variant="outline" size="sm" onClick={() => setRevoking(secret)}>
                        Revogar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      )}
      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title="Gerar novo segredo"
        description="Um segredo novo é criado e mostrado uma única vez. Os segredos atuais continuam válidos por um período de transição, para dar tempo de atualizar a aplicação."
        confirmLabel="Gerar segredo"
        destructive={false}
        pending={rotating}
        onConfirm={() => void rotate()}
      />
      {revoking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRevoking(null)}
          title="Revogar segredo"
          description="O segredo deixa de funcionar imediatamente. Aplicações que ainda o usam não conseguem mais obter tokens."
          confirmLabel="Revogar"
          pending={revoke.isPending}
          onConfirm={() => revoke.mutate(revoking.id ?? '')}
        />
      )}
      {generated && (
        <SecretDialog
          clientId={clientId}
          secret={generated.secret}
          previousExpireAt={generated.previousExpireAt}
          onDone={() => setGenerated(null)}
        />
      )}
    </div>
  )
}
