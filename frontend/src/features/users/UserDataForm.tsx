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
import { Select } from '@/components/ui/select'
import { type ApiError, isApiError } from '@/lib/api/errors'

import { updateUser, type User, userKeys } from './api'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(200, 'Use no máximo 200 caracteres.'),
  email: z.email('Informe um e-mail válido.').max(254),
  givenName: z.string().max(100, 'Use no máximo 100 caracteres.'),
  familyName: z.string().max(100, 'Use no máximo 100 caracteres.'),
  locale: z.enum(['pt-BR', 'en']),
  zoneinfo: z.string().max(64, 'Use no máximo 64 caracteres.'),
  wsecurityAdmin: z.boolean(),
})

type Values = z.infer<typeof schema>

function valuesOf(user: User): Values {
  return {
    name: user.name ?? '',
    email: user.email ?? '',
    givenName: user.givenName ?? '',
    familyName: user.familyName ?? '',
    locale: user.locale === 'en' ? 'en' : 'pt-BR',
    zoneinfo: user.zoneinfo ?? '',
    wsecurityAdmin: Boolean(user.wsecurityAdmin),
  }
}

/** Edição dos campos que a API permite alterar, com `If-Match` da versão lida (RF-USR-04, RF-NAV-07). */
export function UserDataForm({ user, etag, onReload }: { user: User; etag: string | undefined; onReload: () => void }) {
  const queryClient = useQueryClient()
  const id = user.id ?? ''
  const form = useForm<Values>({ resolver: zodResolver(schema), values: valuesOf(user) })

  const save = useMutation({
    mutationFn: (values: Values) =>
      updateUser(
        id,
        {
          name: values.name.trim(),
          email: values.email,
          givenName: values.givenName || undefined,
          familyName: values.familyName || undefined,
          locale: values.locale,
          zoneinfo: values.zoneinfo || undefined,
          wsecurityAdmin: values.wsecurityAdmin,
        },
        etag,
      ),
    onSuccess: async () => {
      showSuccess('Usuário atualizado.')
      await queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
    onError: (error) => {
      if (isApiError(error) && error.isConflict) {
        return
      }
      if (isApiError(error) && error.problem.type?.endsWith('/user-email-conflict')) {
        form.setError('email', { type: 'server', message: 'Já existe um usuário com este e-mail.' })
        return
      }
      applyApiErrors(form, error)
    },
  })

  const conflict = isApiError(save.error) && save.error.isConflict ? (save.error as ApiError) : undefined
  const disabled = user.status === 'DELETED'

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
      <fieldset disabled={disabled || save.isPending} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          label="Nome"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <FormField
          control={form.control}
          name="email"
          label="E-mail"
          description="Ao trocar o e-mail, a pessoa precisa verificá-lo de novo."
          render={(field, props) => <Input type="email" {...field} {...props} />}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="givenName"
            label="Prenome"
            render={(field, props) => <Input {...field} {...props} />}
          />
          <FormField
            control={form.control}
            name="familyName"
            label="Sobrenome"
            render={(field, props) => <Input {...field} {...props} />}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="locale"
            label="Idioma"
            render={(field, props) => (
              <Select {...field} {...props}>
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en">Inglês</option>
              </Select>
            )}
          />
          <FormField
            control={form.control}
            name="zoneinfo"
            label="Fuso horário"
            description="Ex.: America/Sao_Paulo"
            render={(field, props) => <Input {...field} {...props} />}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('wsecurityAdmin')} />
          Administrador da plataforma (recebe <code>wsecurity.admin</code>)
        </label>
        <div>
          <Button type="submit" disabled={disabled || save.isPending || !form.formState.isDirty}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Salvar alterações
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
