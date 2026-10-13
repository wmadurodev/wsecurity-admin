import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'

import { applyApiErrors } from '@/components/api-form'
import { FormField } from '@/components/form-field'
import { PageHeader } from '@/components/page-header'
import { showSuccess } from '@/components/problem-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { catalogKeys, type Module } from '@/features/catalog'
import { type User, UserPicker } from '@/features/users'
import { authz, type Page } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'

import { createTenant, SLUG, suggestSlug, tenantKeys } from './api'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(200, 'Use no máximo 200 caracteres.'),
  slug: z.string().regex(SLUG, 'De 3 a 63 caracteres: minúsculas, números e hífen, sem hífen no início nem no fim.'),
  plan: z.string().max(100, 'Use no máximo 100 caracteres.'),
  modules: z.array(z.string()),
  owner: z.custom<User | null>((value) => value !== null, 'Escolha o dono do tenant.'),
})
type Values = z.infer<typeof schema>

async function contractableModules(): Promise<Module[]> {
  const page = (await authz.get('/admin/v1/modules', { query: { size: 100, sort: 'code,asc' } })).data as Page<Module>
  return page.content.filter((module) => !module.system && module.enabled !== false)
}

/** Criação de tenant (RF-TEN-01): `slug` sugerido pelo nome, módulos iniciais e dono escolhido no IdP. */
export function NewTenantPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const modules = useQuery({ queryKey: [...catalogKeys.all, 'contractable'], queryFn: contractableModules })
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', plan: '', modules: [], owner: null },
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const name = useWatch({ control: form.control, name: 'name' })
  useEffect(() => {
    if (!slugTouched) {
      form.setValue('slug', suggestSlug(name))
    }
  }, [name, slugTouched, form])

  const create = useMutation({
    mutationFn: (values: Values) =>
      createTenant({
        slug: values.slug,
        name: values.name.trim(),
        plan: values.plan.trim() || undefined,
        modules: values.modules,
        // A API aceita só um dos dois (owner.subject ou owner.email); o dono é informado por e-mail (RF-TEN-01).
        owner: { email: values.owner?.email ?? undefined },
      }),
    onSuccess: async (tenant) => {
      showSuccess(`Tenant ${tenant.slug} criado.`)
      await queryClient.invalidateQueries({ queryKey: tenantKeys.all })
      void navigate(`/platform/tenants/${tenant.slug}`)
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        form.setError('slug', {
          type: 'server',
          message: error.problem.detail ?? 'Este slug já está em uso ou reservado.',
        })
      } else if (isApiError(error) && error.problem.type?.includes('/tenant-owner')) {
        form.setError('owner', {
          type: 'server',
          message: error.problem.detail ?? error.problem.title ?? 'Dono inválido.',
        })
      } else if (isApiError(error) && error.problem.type?.endsWith('/tenant-slug-invalid')) {
        form.setError('slug', { type: 'server', message: error.problem.title ?? 'Slug inválido.' })
      } else {
        applyApiErrors(form, error)
      }
    },
  })

  return (
    <>
      <PageHeader title="Novo tenant" description="O dono recebe o papel owner no tenant." />
      <form
        className="flex max-w-xl flex-col gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) => create.mutate(values))}
      >
        <FormField
          control={form.control}
          name="name"
          label="Nome"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <FormField
          control={form.control}
          name="slug"
          label="Slug"
          description="Identificador na URL e nos tokens. Não pode mudar depois e fica reservado mesmo após a exclusão."
          render={(field, props) => (
            <Input
              {...field}
              {...props}
              onChange={(event) => {
                setSlugTouched(true)
                field.onChange(event.target.value)
              }}
            />
          )}
        />
        <FormField
          control={form.control}
          name="plan"
          label="Plano"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Módulos contratados</legend>
          <p className="text-xs text-muted-foreground">O módulo core é implícito em todo tenant.</p>
          {modules.isPending && <p className="text-sm text-muted-foreground">Carregando o catálogo…</p>}
          <div className="grid gap-1 sm:grid-cols-2">
            {modules.data?.map((module) => (
              <label key={module.code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" value={module.code} {...form.register('modules')} />
                {module.name} <code className="text-xs text-muted-foreground">{module.code}</code>
              </label>
            ))}
          </div>
        </fieldset>
        <Controller
          control={form.control}
          name="owner"
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dono">Dono</Label>
              <UserPicker
                id="dono"
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(fieldState.error)}
                describedBy={fieldState.error ? 'dono-erro' : undefined}
              />
              {fieldState.error?.message && (
                <p id="dono-erro" role="alert" className="text-xs text-destructive">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />
        <div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Criar tenant
          </Button>
        </div>
      </form>
    </>
  )
}
