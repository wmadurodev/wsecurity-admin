import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { isApiError } from '@/lib/api/errors'

import { clientKeys, getClient, setClientEnabled, updateClient } from './api'
import { requestFromValues, valuesFromClient, type ClientValues } from './client-form-model'
import { ClientForm } from './ClientForm'
import { ClientSecretsTab } from './ClientSecretsTab'
import { SecretDialog } from './SecretDialog'

/** Detalhe do cliente (RF-CLI-01, RF-CLI-03, RF-CLI-04): configuração editável, segredos e ativação. */
export function ClientDetailPage() {
  const { clientId = '' } = useParams()
  const [search, setSearch] = useSearchParams()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: clientKeys.detail(clientId), queryFn: () => getClient(clientId) })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<unknown>()
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setClientEnabled(clientId, enabled),
    onSuccess: async (_, enabled) => {
      setToggling(false)
      showSuccess(enabled ? 'Cliente ativado.' : 'Cliente desativado.')
      await queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
    onError: (error) => {
      setToggling(false)
      showProblem(error)
    },
  })

  async function save(values: ClientValues) {
    if (!query.data) {
      return
    }
    setSaving(true)
    setSaveError(undefined)
    try {
      const { secret } = await updateClient(clientId, requestFromValues(values, query.data))
      showSuccess('Configuração salva.')
      await queryClient.invalidateQueries({ queryKey: clientKeys.all })
      if (secret) {
        setNewSecret(secret)
      }
    } catch (error) {
      setSaveError(error)
      if (!isApiError(error) || (error.violations.length === 0 && Object.keys(error.fieldErrors).length === 0)) {
        showProblem(error)
      }
    } finally {
      setSaving(false)
    }
  }

  if (query.isPending) {
    return <LoadingState />
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  const client = query.data
  const confidential = client.type === 'CONFIDENTIAL'
  const tab = search.get('aba') ?? 'configuracao'
  return (
    <>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <StatusBadge status={client.enabled ? 'ACTIVE' : 'DISABLED'} />
          <Badge variant="outline">{confidential ? 'confidencial' : 'público'}</Badge>
          {client.allowedAdminScope && <Badge variant="warning">wsecurity.admin autorizado</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          <code>{client.clientId}</code>
        </p>
        <div>
          <Button variant={client.enabled ? 'destructive' : 'outline'} size="sm" onClick={() => setToggling(true)}>
            {client.enabled ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      </div>
      <Tabs
        label="Seções do cliente"
        value={tab}
        onValueChange={(value) => setSearch(value === 'configuracao' ? {} : { aba: value }, { replace: true })}
        items={[
          {
            value: 'configuracao',
            label: 'Configuração',
            content: (
              <ClientForm
                initial={valuesFromClient(client)}
                editing
                submitLabel="Salvar configuração"
                pending={saving}
                error={saveError}
                onSubmit={(values) => void save(values)}
              />
            ),
          },
          ...(confidential
            ? [{ value: 'segredos', label: 'Segredos', content: <ClientSecretsTab clientId={clientId} /> }]
            : []),
        ]}
      />
      <ConfirmDialog
        open={toggling}
        onOpenChange={setToggling}
        title={client.enabled ? 'Desativar cliente' : 'Ativar cliente'}
        description={
          client.enabled
            ? 'O cliente não consegue mais obter tokens, e os tokens já emitidos para ele são revogados.'
            : 'O cliente volta a poder obter tokens.'
        }
        confirmLabel={client.enabled ? 'Desativar' : 'Ativar'}
        destructive={Boolean(client.enabled)}
        pending={toggle.isPending}
        onConfirm={() => toggle.mutate(!client.enabled)}
      />
      {newSecret && <SecretDialog clientId={clientId} secret={newSecret} onDone={() => setNewSecret(null)} />}
    </>
  )
}
