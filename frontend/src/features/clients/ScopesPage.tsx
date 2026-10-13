import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { applyApiErrors } from '@/components/api-form'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField } from '@/components/form-field'
import { PageHeader } from '@/components/page-header'
import { showProblem, showSuccess } from '@/components/problem-toast'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { clientKeys, createScope, listScopes, type Scope, updateScope } from './api'

const description = z.string().trim().min(1, 'Informe a descrição.').max(300, 'Use no máximo 300 caracteres.')
const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome.')
    .max(100, 'Use no máximo 100 caracteres.')
    .regex(
      /^[a-z][a-z0-9_.:-]{1,99}$/,
      'Comece com letra minúscula e use minúsculas, números e . _ : - (ex.: pedidos.leitura).',
    ),
  descriptionPt: description,
  descriptionEn: description,
})
const editSchema = createSchema.omit({ name: true })
type CreateValues = z.infer<typeof createSchema>
type EditValues = z.infer<typeof editSchema>

/** Escopos do IdP (RF-CLI-06). Escopos padrão (OIDC e do wsecurity) são imutáveis e aparecem sem ações. */
export function ScopesPage() {
  const queryClient = useQueryClient()
  const scopes = useQuery({ queryKey: clientKeys.scopes, queryFn: listScopes })
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Scope | null>(null)
  const [toggling, setToggling] = useState<Scope | null>(null)

  const toggle = useMutation({
    mutationFn: (scope: Scope) => updateScope(scope.name ?? '', { enabled: scope.enabled === false }),
    onSuccess: async (_, scope) => {
      setToggling(null)
      showSuccess(scope.enabled === false ? 'Escopo reativado.' : 'Escopo desativado.')
      await queryClient.invalidateQueries({ queryKey: clientKeys.scopes })
    },
    onError: (error) => {
      setToggling(null)
      showProblem(error)
    },
  })

  return (
    <>
      <PageHeader
        title="Escopos"
        description="Permissões que os clientes podem pedir ao IdP."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Novo escopo
          </Button>
        }
      />
      {scopes.isPending && <LoadingState />}
      {scopes.isError && <ErrorState error={scopes.error} onRetry={() => void scopes.refetch()} />}
      {scopes.data?.length === 0 && <EmptyState title="Nenhum escopo" />}
      {scopes.data && scopes.data.length > 0 && (
        <Table>
          <TableCaption className="sr-only">Escopos do IdP</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scopes.data.map((scope) => (
              <TableRow key={scope.name}>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-2">
                    <code>{scope.name}</code>
                    {scope.standard && <Badge variant="secondary">padrão</Badge>}
                  </span>
                </TableCell>
                <TableCell className="max-w-md text-sm">{scope.descriptionPt}</TableCell>
                <TableCell>
                  <StatusBadge status={scope.enabled === false ? 'DISABLED' : 'ACTIVE'} />
                </TableCell>
                <TableCell className="text-right">
                  {!scope.standard && (
                    <span className="inline-flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(scope)}>
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setToggling(scope)}>
                        {scope.enabled === false ? 'Reativar' : 'Desativar'}
                      </Button>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {creating && <CreateScopeDialog onClose={() => setCreating(false)} />}
      {editing && <EditScopeDialog scope={editing} onClose={() => setEditing(null)} />}
      {toggling && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setToggling(null)}
          title={toggling.enabled === false ? 'Reativar escopo' : 'Desativar escopo'}
          description={
            toggling.enabled === false
              ? 'Os clientes voltam a poder pedir este escopo.'
              : 'Os clientes não conseguem mais pedir este escopo em novas autorizações.'
          }
          confirmLabel={toggling.enabled === false ? 'Reativar' : 'Desativar'}
          destructive={toggling.enabled !== false}
          pending={toggle.isPending}
          onConfirm={() => toggle.mutate(toggling)}
        />
      )}
    </>
  )
}

function CreateScopeDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', descriptionPt: '', descriptionEn: '' },
  })
  const create = useMutation({
    mutationFn: (values: CreateValues) => createScope(values),
    onSuccess: async () => {
      showSuccess('Escopo criado.')
      await queryClient.invalidateQueries({ queryKey: clientKeys.scopes })
      onClose()
    },
    onError: (error) => applyApiErrors(form, error),
  })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} aria-labelledby="novo-escopo">
      <DialogClose onClose={onClose} />
      <DialogHeader>
        <DialogTitle id="novo-escopo">Novo escopo</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => create.mutate(values))}>
        <FormField
          control={form.control}
          name="name"
          label="Nome"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <FormField
          control={form.control}
          name="descriptionPt"
          label="Descrição (português)"
          description="Aparece na tela de consentimento."
          render={(field, props) => <Input {...field} {...props} />}
        />
        <FormField
          control={form.control}
          name="descriptionEn"
          label="Descrição (inglês)"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Criar escopo
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function EditScopeDialog({ scope, onClose }: { scope: Scope; onClose: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { descriptionPt: scope.descriptionPt ?? '', descriptionEn: scope.descriptionEn ?? '' },
  })
  const save = useMutation({
    mutationFn: (values: EditValues) => updateScope(scope.name ?? '', values),
    onSuccess: async () => {
      showSuccess('Escopo atualizado.')
      await queryClient.invalidateQueries({ queryKey: clientKeys.scopes })
      onClose()
    },
    onError: (error) => applyApiErrors(form, error),
  })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} aria-labelledby="editar-escopo">
      <DialogClose onClose={onClose} />
      <DialogHeader>
        <DialogTitle id="editar-escopo">Editar escopo {scope.name}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <FormField
          control={form.control}
          name="descriptionPt"
          label="Descrição (português)"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <FormField
          control={form.control}
          name="descriptionEn"
          label="Descrição (inglês)"
          render={(field, props) => <Input {...field} {...props} />}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Salvar
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
