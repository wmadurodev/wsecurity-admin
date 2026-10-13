import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'

import { applyApiErrors } from '@/components/api-form'
import { FormField } from '@/components/form-field'
import { showSuccess } from '@/components/problem-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { isApiError } from '@/lib/api/errors'

import { createUser, userKeys } from './api'
import { passwordPolicyMessage } from './labels'

const schema = z
  .object({
    email: z.email('Informe um e-mail válido.').max(254, 'Use no máximo 254 caracteres.'),
    name: z.string().trim().min(1, 'Informe o nome.').max(200, 'Use no máximo 200 caracteres.'),
    wsecurityAdmin: z.boolean(),
    access: z.enum(['invite', 'password']),
    password: z.string(),
  })
  .superRefine((value, context) => {
    if (value.access === 'password' && (value.password.length < 12 || value.password.length > 128)) {
      context.addIssue({ code: 'custom', path: ['password'], message: 'A senha deve ter de 12 a 128 caracteres.' })
    }
  })

type Values = z.infer<typeof schema>

/** Criação de usuário por convite (padrão) ou com senha inicial (RF-USR-03). */
export function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '', wsecurityAdmin: false, access: 'invite', password: '' },
  })
  const access = useWatch({ control: form.control, name: 'access' })

  const create = useMutation({
    mutationFn: (values: Values) =>
      createUser({
        email: values.email,
        name: values.name.trim(),
        wsecurityAdmin: values.wsecurityAdmin,
        password: values.access === 'password' ? values.password : undefined,
      }),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: userKeys.all })
      showSuccess(access === 'invite' ? 'Usuário criado. O convite foi enviado por e-mail.' : 'Usuário criado.')
      form.reset()
      onOpenChange(false)
      if (user.id) {
        void navigate(`/platform/users/${user.id}`)
      }
    },
    onError: (error) => {
      if (isApiError(error) && error.problem.type?.endsWith('/password-policy-violation')) {
        form.setError('password', { type: 'server', message: passwordPolicyMessage(error.violations) })
      } else if (isApiError(error) && error.problem.type?.endsWith('/user-email-conflict')) {
        form.setError('email', { type: 'server', message: 'Já existe um usuário com este e-mail.' })
      } else {
        applyApiErrors(form, error)
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-labelledby="novo-usuario-titulo">
      <DialogClose onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle id="novo-usuario-titulo">Novo usuário</DialogTitle>
        <DialogDescription>
          Por convite, a pessoa define a própria senha pelo link enviado por e-mail.
        </DialogDescription>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => create.mutate(values))}>
        <FormField
          control={form.control}
          name="email"
          label="E-mail"
          render={(field, props) => <Input type="email" autoComplete="off" {...field} {...props} />}
        />
        <FormField
          control={form.control}
          name="name"
          label="Nome"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Acesso</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="invite" {...form.register('access')} />
            Convite por e-mail
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="password" {...form.register('access')} />
            Senha inicial
          </label>
        </fieldset>
        {access === 'password' && (
          <FormField
            control={form.control}
            name="password"
            label="Senha inicial"
            description="De 12 a 128 caracteres, sem o nome nem o e-mail. A pessoa troca no primeiro acesso."
            render={(field, props) => <Input type="password" autoComplete="new-password" {...field} {...props} />}
          />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('wsecurityAdmin')} />
          Administrador da plataforma (recebe <code>wsecurity.admin</code>)
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Criar usuário
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
