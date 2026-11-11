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

import { catalogKeys, createModule, isSystemUrl, MODULE_CODE, type Module, updateModule } from './api'

const schema = z.object({
  code: z.string().regex(MODULE_CODE, 'De 2 a 31 caracteres: minúsculas, números e hífen, começando por letra.'),
  name: z.string().trim().min(1, 'Informe o nome.').max(200, 'Use no máximo 200 caracteres.'),
  description: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
  enabled: z.boolean(),
  url: z
    .string()
    .trim()
    .refine((value) => value === '' || isSystemUrl(value), {
      message: 'Use um endereço http ou https completo (ex.: https://sistema.exemplo.com), sem usuário, senha ou #.',
    }),
})
type Values = z.infer<typeof schema>

/** Cadastro e alteração de módulo (RF-CAT-01). O código é imutável. */
export function ModuleFormDialog({ module, onClose }: { module?: Module; onClose: (created?: Module) => void }) {
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: module?.code ?? '',
      name: module?.name ?? '',
      description: module?.description ?? '',
      enabled: module?.enabled !== false,
      url: module?.url ?? '',
    },
  })
  const save = useMutation({
    mutationFn: (values: Values) =>
      module
        ? updateModule(module.code ?? '', {
            name: values.name.trim(),
            description: values.description,
            enabled: values.enabled,
            // Vazio remove o endereço (fase 0014).
            url: values.url,
          })
        : createModule({ ...values, name: values.name.trim(), url: values.url || undefined }),
    onSuccess: async (saved) => {
      showSuccess(module ? 'Módulo atualizado.' : 'Módulo criado.')
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all })
      onClose(module ? undefined : saved)
    },
    onError: (error) => applyApiErrors(form, error),
  })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} aria-labelledby="modulo-titulo">
      <DialogClose onClose={() => onClose()} />
      <DialogHeader>
        <DialogTitle id="modulo-titulo">{module ? `Editar módulo ${module.code}` : 'Novo módulo'}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        {!module && (
          <FormField
            control={form.control}
            name="code"
            label="Código"
            description="Prefixo das funcionalidades (ex.: faturamento). Não pode mudar depois."
            render={(field, props) => <Input {...field} {...props} />}
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
          name="description"
          label="Descrição"
          render={(field, props) => <Textarea rows={3} {...field} {...props} />}
        />
        <FormField
          control={form.control}
          name="url"
          label="Endereço do sistema"
          description="Opcional. Vira o card do sistema na página inicial do IdP para quem tem acesso (ex.: https://sistema.exemplo.com)."
          render={(field, props) => <Input type="url" inputMode="url" placeholder="https://" {...field} {...props} />}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('enabled')} />
          Habilitado (pode ser contratado e concedido)
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {module ? 'Salvar' : 'Criar módulo'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
