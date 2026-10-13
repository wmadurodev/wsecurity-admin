import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DateTime } from '@/components/date-time'
import { PageHeader } from '@/components/page-header'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { clientKeys, listKeys, rotateKeys } from './api'

const MODULES = {
  idp: {
    title: 'IdP (wsecurity-authentication)',
    description: 'Assinam os tokens de acesso e de ID emitidos pelo IdP.',
  },
  authz: {
    title: 'Autorização (wsecurity-authorization)',
    description: 'Assinam os tokens de tenant emitidos pela autorização.',
  },
} as const

/** Chaves de assinatura dos dois módulos e rotação imediata (RF-KEY-01, RF-KEY-02). */
export function KeysPage() {
  return (
    <>
      <PageHeader title="Chaves de assinatura" description="Chaves dos JWKS do IdP e da autorização." />
      <div className="flex flex-col gap-10">
        <KeysSection module="idp" />
        <KeysSection module="authz" />
      </div>
    </>
  )
}

function KeysSection({ module }: { module: 'idp' | 'authz' }) {
  const queryClient = useQueryClient()
  const keys = useQuery({ queryKey: clientKeys.keys(module), queryFn: () => listKeys(module) })
  const [confirming, setConfirming] = useState(false)
  const rotate = useMutation({
    mutationFn: () => rotateKeys(module),
    onSuccess: async () => {
      setConfirming(false)
      showSuccess('Chaves giradas.')
      await queryClient.invalidateQueries({ queryKey: clientKeys.keys(module) })
    },
    onError: (error) => {
      setConfirming(false)
      showProblem(error)
    },
  })
  const info = MODULES[module]
  const headingId = `chaves-${module}`
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            {info.title}
          </h2>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>
        <Button variant="outline" onClick={() => setConfirming(true)}>
          <RotateCw aria-hidden="true" />
          Girar agora
        </Button>
      </div>
      {keys.isPending && <LoadingState />}
      {keys.isError && <ErrorState error={keys.error} onRetry={() => void keys.refetch()} />}
      {keys.data?.length === 0 && <EmptyState title="Nenhuma chave" />}
      {keys.data && keys.data.length > 0 && (
        <Table>
          <TableCaption className="sr-only">{info.title}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>kid</TableHead>
              <TableHead>Algoritmo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Criada</TableHead>
              <TableHead>Ativada</TableHead>
              <TableHead>Aposentada</TableHead>
              <TableHead>Expira</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.data.map((key) => (
              <TableRow key={key.kid}>
                <TableCell>
                  <code className="text-xs break-all">{key.kid}</code>
                </TableCell>
                <TableCell>{key.algorithm}</TableCell>
                <TableCell>
                  <StatusBadge status={key.status} />
                </TableCell>
                <TableCell>
                  <DateTime value={key.createdAt} />
                </TableCell>
                <TableCell>
                  <DateTime value={key.activatedAt} />
                </TableCell>
                <TableCell>
                  <DateTime value={key.retiredAt} />
                </TableCell>
                <TableCell>
                  <DateTime value={key.expiresAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Girar as chaves: ${info.title}`}
        description="A próxima chave passa a assinar os novos tokens agora, e a chave ativa é aposentada. A aposentada continua no JWKS até expirar, para validar os tokens já emitidos. Clientes que guardam o JWKS em cache passam a buscar a chave nova."
        confirmLabel="Girar agora"
        requireText="girar"
        pending={rotate.isPending}
        onConfirm={() => rotate.mutate()}
      />
    </section>
  )
}
