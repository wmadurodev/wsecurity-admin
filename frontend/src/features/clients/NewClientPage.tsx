import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { PageHeader } from '@/components/page-header'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { isApiError } from '@/lib/api/errors'

import { clientKeys, createClient } from './api'
import { NEW_CLIENT, requestFromValues, type ClientValues } from './client-form-model'
import { ClientForm } from './ClientForm'
import { SecretDialog } from './SecretDialog'

/**
 * Registro de cliente (RF-CLI-02). A chamada não passa pelo cache do TanStack Query: o segredo devolvido fica só no
 * estado desta página até "Já guardei" (RN-05).
 */
export function NewClientPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>()
  const [created, setCreated] = useState<{ clientId: string; secret: string } | null>(null)

  async function submit(values: ClientValues) {
    setPending(true)
    setError(undefined)
    try {
      const { client, secret } = await createClient(requestFromValues(values))
      await queryClient.invalidateQueries({ queryKey: clientKeys.all })
      showSuccess('Cliente registrado.')
      const clientId = client.clientId ?? ''
      if (secret) {
        setCreated({ clientId, secret })
      } else {
        void navigate(`/platform/clients/${encodeURIComponent(clientId)}`)
      }
    } catch (failure) {
      setError(failure)
      if (!isApiError(failure) || (failure.violations.length === 0 && Object.keys(failure.fieldErrors).length === 0)) {
        showProblem(failure)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <PageHeader title="Novo cliente" description="Registre uma aplicação no IdP." />
      <ClientForm
        initial={NEW_CLIENT}
        editing={false}
        submitLabel="Registrar cliente"
        pending={pending}
        error={error}
        onSubmit={(values) => void submit(values)}
      />
      {created && (
        <SecretDialog
          clientId={created.clientId}
          secret={created.secret}
          onDone={() => {
            const clientId = created.clientId
            setCreated(null)
            void navigate(`/platform/clients/${encodeURIComponent(clientId)}`, { replace: true })
          }}
        />
      )}
    </>
  )
}
