import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { applyApiErrors } from '@/components/api-form'
import { ConflictNotice } from '@/components/conflict-notice'
import { FormField } from '@/components/form-field'
import { showSuccess } from '@/components/problem-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type ApiError, isApiError } from '@/lib/api/errors'
import { sessionKey } from '@/lib/session-context'

import { type TenantProfile, tenantAreaKeys, updateTenantProfile } from './api'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(200, 'Use no máximo 200 caracteres.'),
  settings: z.string().refine((text) => {
    if (!text.trim()) {
      return true
    }
    try {
      const value: unknown = JSON.parse(text)
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    } catch {
      return false
    }
  }, 'Informe um objeto JSON (ex.: {"fusoHorario": "America/Sao_Paulo"}).'),
})
type Values = z.infer<typeof schema>

/** Nome e `settings` do tenant pelo próprio tenant, com `If-Match` (RF-TAD-02). */
export function TenantProfileForm({
  tenant,
  etag,
  onReload,
}: {
  tenant: TenantProfile
  etag: string | undefined
  onReload: () => void
}) {
  const queryClient = useQueryClient()
  const slug = tenant.slug ?? ''
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: tenant.name ?? '',
      settings:
        tenant.settings && Object.keys(tenant.settings).length > 0 ? JSON.stringify(tenant.settings, null, 2) : '',
    },
  })
  const save = useMutation({
    mutationFn: (values: Values) =>
      updateTenantProfile(
        slug,
        {
          name: values.name.trim(),
          settings: values.settings.trim() ? (JSON.parse(values.settings) as Record<string, unknown>) : {},
        },
        etag,
      ),
    onSuccess: async () => {
      showSuccess('Dados do tenant salvos.')
      await queryClient.invalidateQueries({ queryKey: tenantAreaKeys.tenant(slug) })
      await queryClient.invalidateQueries({ queryKey: sessionKey })
    },
    onError: (error) => {
      if (!(isApiError(error) && error.isConflict)) {
        applyApiErrors(form, error)
      }
    },
  })
  const conflict = isApiError(save.error) && save.error.isConflict ? (save.error as ApiError) : undefined
  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      noValidate
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
    >
      {conflict && (
        <ConflictNotice
          error={conflict}
          onReload={() => {
            save.reset()
            onReload()
          }}
        />
      )}
      <fieldset disabled={save.isPending} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          label="Nome"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <FormField
          control={form.control}
          name="settings"
          label="Configurações (settings)"
          description="Objeto JSON livre do tenant."
          render={(field, props) => <Textarea rows={4} className="font-mono" {...field} {...props} />}
        />
        <div>
          <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Salvar dados
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
