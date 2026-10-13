import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { applyApiErrors } from '@/components/api-form'
import { FormField } from '@/components/form-field'
import { showSuccess } from '@/components/problem-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { isApiError } from '@/lib/api/errors'

import { addMember, tenantAreaKeys } from './api'
import { SUBJECT_TYPE_OPTIONS, toIso } from './labels'
import { RolePicker } from './RolePicker'

const schema = z
  .object({
    by: z.enum(['email', 'subject']),
    email: z.string().trim(),
    name: z.string().trim().max(200, 'Use no máximo 200 caracteres.'),
    invite: z.boolean(),
    subject: z.string().trim().max(255, 'Use no máximo 255 caracteres.'),
    subjectType: z.enum(['USER', 'CLIENT']),
    roles: z.array(z.string()),
    expiresAt: z.string(),
  })
  .superRefine((value, context) => {
    if (value.by === 'email' && !z.email().safeParse(value.email).success) {
      context.addIssue({ code: 'custom', path: ['email'], message: 'Informe um e-mail válido.' })
    }
    if (value.by === 'subject' && !value.subject) {
      context.addIssue({ code: 'custom', path: ['subject'], message: 'Informe o subject.' })
    }
    if (value.expiresAt && new Date(value.expiresAt).getTime() <= Date.now()) {
      context.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Informe uma data futura.' })
    }
  })
type Values = z.infer<typeof schema>

const defaults: Values = {
  by: 'email',
  email: '',
  name: '',
  invite: true,
  subject: '',
  subjectType: 'USER',
  roles: [],
  expiresAt: '',
}

/** Adiciona um membro por e-mail (com convite opcional) ou por `subject` (RF-MEM-02). */
export function AddMemberDialog({
  slug,
  open,
  onOpenChange,
}: {
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  const by = useWatch({ control: form.control, name: 'by' })

  function close() {
    form.reset(defaults)
    onOpenChange(false)
  }

  const add = useMutation({
    mutationFn: (values: Values) =>
      addMember(slug, {
        ...(values.by === 'email'
          ? { email: values.email, name: values.name || undefined, invite: values.invite }
          : { subject: values.subject, subjectType: values.subjectType }),
        roles: values.roles,
        expiresAt: toIso(values.expiresAt) ?? undefined,
      }),
    onSuccess: async (_, values) => {
      await queryClient.invalidateQueries({ queryKey: tenantAreaKeys.membersAll(slug) })
      showSuccess(
        values.by === 'email'
          ? `${values.email} adicionado ao tenant${values.invite ? '. O convite foi enviado por e-mail' : ''}.`
          : `${values.subject} adicionado ao tenant.`,
      )
      close()
    },
    onError: (error, values) => {
      if (isApiError(error) && error.problem.type?.endsWith('/membership-conflict')) {
        form.setError(values.by, {
          type: 'server',
          message: 'Já é membro deste tenant. Abra o membro na lista para alterar os papéis.',
        })
      } else {
        applyApiErrors(form, error)
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} aria-labelledby="novo-membro">
      <DialogClose onClose={close} />
      <DialogHeader>
        <DialogTitle id="novo-membro">Adicionar membro</DialogTitle>
        <DialogDescription>
          Por e-mail, a conta é localizada no IdP (ou criada, com convite). Por subject, informe o identificador da
          conta ou do cliente.
        </DialogDescription>
      </DialogHeader>
      <form
        id="form-novo-membro"
        className="flex flex-col gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) => add.mutate(values))}
      >
        <fieldset disabled={add.isPending} className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Identificar por" className="flex gap-4 text-sm">
            {(['email', 'subject'] as const).map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="by"
                  checked={by === option}
                  onChange={() => form.setValue('by', option, { shouldDirty: true })}
                />
                {option === 'email' ? 'Por e-mail' : 'Por subject'}
              </label>
            ))}
          </div>
          {by === 'email' ? (
            <>
              <FormField
                control={form.control}
                name="email"
                label="E-mail"
                render={(field, props) => <Input type="email" autoComplete="off" {...field} {...props} />}
              />
              <FormField
                control={form.control}
                name="name"
                label="Nome (opcional)"
                description="Usado se a conta ainda não existir."
                render={(field, props) => <Input {...field} {...props} />}
              />
              <Controller
                control={form.control}
                name="invite"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                    Enviar convite por e-mail
                  </label>
                )}
              />
            </>
          ) : (
            <>
              <FormField
                control={form.control}
                name="subject"
                label="Subject"
                render={(field, props) => <Input autoComplete="off" className="font-mono" {...field} {...props} />}
              />
              <FormField
                control={form.control}
                name="subjectType"
                label="Tipo"
                render={(field, props) => (
                  <Select {...field} {...props}>
                    {SUBJECT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              />
            </>
          )}
          <Controller
            control={form.control}
            name="roles"
            render={({ field }) => (
              <RolePicker slug={slug} legend="Papéis" value={field.value} onChange={field.onChange} />
            )}
          />
          <FormField
            control={form.control}
            name="expiresAt"
            label="Expira em (opcional)"
            description="Depois dessa data o vínculo deixa de conceder permissões."
            render={(field, props) => <Input type="datetime-local" {...field} {...props} />}
          />
        </fieldset>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={close} disabled={add.isPending}>
          Cancelar
        </Button>
        <Button type="submit" form="form-novo-membro" disabled={add.isPending}>
          {add.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Adicionar
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
