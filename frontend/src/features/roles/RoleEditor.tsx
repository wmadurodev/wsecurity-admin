import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { FormField } from '@/components/form-field'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { catalogKeys, listAllFeatures } from '@/features/catalog'

import { ROLE_CODE } from './api'
import { type Access, type Grant, type MatrixFeature, PermissionMatrix } from './components/PermissionMatrix'
import { toMatrix } from './matrix-features'

const schema = z.object({
  code: z.string().regex(ROLE_CODE, 'De 2 a 50 caracteres: minúsculas, números e hífen, começando por letra.'),
  name: z.string().trim().min(1, 'Informe o nome.').max(200, 'Use no máximo 200 caracteres.'),
  description: z.string().max(2000, 'Use no máximo 2000 caracteres.'),
})
export type RoleValues = z.infer<typeof schema>

/**
 * Funcionalidades da matriz vindas de fora (papel do tenant): só as dos módulos contratados, com o anti-escalonamento
 * em `canGrant` (RF-ROL-03). Sem elas, o editor usa todo o catálogo (papel global).
 */
export interface RoleMatrixSource {
  features: MatrixFeature[] | undefined
  pending: boolean
  error: unknown
  onRetry: () => void
  canGrant?: (feature: string, access: Access) => boolean
  deniedHint?: string
}

/** Formulário de papel com a matriz de permissões (RF-ROL-01, RF-ROL-02, RF-ROL-03). */
export function RoleEditor({
  initial,
  initialGrants,
  creating,
  submitLabel,
  pending,
  notice,
  matrix,
  onSubmit,
}: {
  initial: RoleValues
  initialGrants: Grant[]
  creating: boolean
  submitLabel: string
  pending: boolean
  notice?: ReactNode
  matrix?: RoleMatrixSource
  onSubmit: (values: RoleValues, grants: Grant[]) => void
}) {
  const form = useForm<RoleValues>({ resolver: zodResolver(schema), defaultValues: initial })
  const [grants, setGrants] = useState<Grant[]>(initialGrants)
  const catalog = useQuery({ queryKey: catalogKeys.allFeatures, queryFn: listAllFeatures, enabled: !matrix })
  const source: RoleMatrixSource = matrix ?? {
    features: catalog.data && toMatrix(catalog.data),
    pending: catalog.isPending,
    error: catalog.error,
    onRetry: () => void catalog.refetch(),
  }

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values, grants))}>
      <section className="flex max-w-xl flex-col gap-4">
        {creating && (
          <FormField
            control={form.control}
            name="code"
            label="Código"
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
          render={(field, props) => <Textarea rows={2} {...field} {...props} />}
        />
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="concessoes">
        <h2 id="concessoes" className="text-lg font-semibold">
          Concessões
        </h2>
        {source.pending && <LoadingState label="Carregando as funcionalidades…" />}
        {Boolean(source.error) && <ErrorState error={source.error} onRetry={source.onRetry} />}
        {source.features && (
          <PermissionMatrix
            features={source.features}
            grants={grants}
            onChange={setGrants}
            canGrant={source.canGrant}
            deniedHint={source.deniedHint}
          />
        )}
      </section>
      {notice}
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
