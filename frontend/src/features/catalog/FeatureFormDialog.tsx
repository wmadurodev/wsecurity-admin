import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { applyApiErrors } from '@/components/api-form'
import { FormField } from '@/components/form-field'
import { showSuccess } from '@/components/problem-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import { catalogKeys, createFeature, FEATURE_NAME, type Feature, updateFeature } from './api'

/** Cadastro e alteração de funcionalidade (RF-CAT-02). O código é `<módulo>.<nome>` e imutável. */
export function FeatureFormDialog({
  module,
  feature,
  onClose,
}: {
  module: string
  feature?: Feature
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const schema = z.object({
    suffix: z
      .string()
      .regex(FEATURE_NAME, 'Minúsculas, números e hífen, em partes separadas por ponto (ex.: notas.emitir).')
      .max(99 - module.length, 'Código longo demais.'),
    name: z.string().trim().min(1, 'Informe o nome.').max(200, 'Use no máximo 200 caracteres.'),
    description: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
    category: z.string().max(100, 'Use no máximo 100 caracteres.'),
    enabled: z.boolean(),
  })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      suffix: feature?.code?.slice(module.length + 1) ?? '',
      name: feature?.name ?? '',
      description: feature?.description ?? '',
      category: feature?.category ?? '',
      enabled: feature?.enabled !== false,
    },
  })
  const save = useMutation({
    mutationFn: (values: Values) => {
      const common = {
        name: values.name.trim(),
        description: values.description,
        category: values.category.trim() || undefined,
      }
      return feature
        ? updateFeature(module, feature.code ?? '', { ...common, enabled: values.enabled })
        : createFeature(module, { ...common, code: `${module}.${values.suffix}` })
    },
    onSuccess: async () => {
      showSuccess(feature ? 'Funcionalidade atualizada.' : 'Funcionalidade criada.')
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all })
      onClose()
    },
    onError: (error) => applyApiErrors(form, error),
  })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} aria-labelledby="funcionalidade-titulo">
      <DialogClose onClose={onClose} />
      <DialogHeader>
        <DialogTitle id="funcionalidade-titulo">
          {feature ? `Editar ${feature.code}` : 'Nova funcionalidade'}
        </DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        {!feature && (
          <FormField
            control={form.control}
            name="suffix"
            label="Código"
            description={`O código fica ${module}.<código>. Não pode mudar depois.`}
            render={(field, props) => (
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm text-muted-foreground">{module}.</span>
                <Input {...field} {...props} />
              </div>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="name"
          label="Nome"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <FormField
          control={form.control}
          name="category"
          label="Categoria"
          description="Agrupa as funcionalidades na matriz de permissões (opcional)."
          render={(field, props) => <Input {...field} {...props} />}
        />
        <FormField
          control={form.control}
          name="description"
          label="Descrição"
          render={(field, props) => <Textarea rows={2} {...field} {...props} />}
        />
        {feature && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('enabled')} />
            Habilitada (pode ser concedida em papéis)
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {feature ? 'Salvar' : 'Criar funcionalidade'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
