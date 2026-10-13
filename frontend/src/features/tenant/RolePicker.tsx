import { useQuery } from '@tanstack/react-query'

import { ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useSession } from '@/lib/session-context'

import { listTenantRoles, tenantAreaKeys } from './api'
import { canAssign } from './permissions'

/**
 * Papéis disponíveis ao tenant, com os que o chamador não pode atribuir desabilitados (0002/RN-07). Sem
 * `core.roles:read` não há como listar os papéis: os códigos são digitados, e a API valida.
 */
export function RolePicker({
  slug,
  value,
  onChange,
  legend,
}: {
  slug: string
  value: string[]
  onChange: (roles: string[]) => void
  legend: string
}) {
  const session = useSession()
  const listable = session.can(slug, 'core.roles:read')
  const roles = useQuery({
    queryKey: tenantAreaKeys.roles(slug),
    queryFn: () => listTenantRoles(slug),
    enabled: listable,
  })

  if (!listable) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${slug}-papeis`} className="text-sm font-medium">
          {legend}
        </label>
        <Input
          id={`${slug}-papeis`}
          value={value.join(', ')}
          placeholder="ex.: viewer, financeiro"
          onChange={(event) =>
            onChange(
              event.target.value
                .split(',')
                .map((code) => code.trim())
                .filter(Boolean),
            )
          }
        />
        <p className="text-xs text-muted-foreground">
          Códigos separados por vírgula. Sem permissão para ver os papéis, a lista não está disponível.
        </p>
      </div>
    )
  }
  if (roles.isPending) {
    return <LoadingState label="Carregando os papéis…" />
  }
  if (roles.isError) {
    return <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
  }

  function toggle(code: string, checked: boolean) {
    onChange(checked ? [...value, code] : value.filter((item) => item !== code))
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {roles.data.map((role) => {
        const code = role.code ?? ''
        const assignable = canAssign(session, slug, role)
        const checked = value.includes(code)
        return (
          <label
            key={code}
            className={`flex items-start gap-2 text-sm ${assignable ? '' : 'cursor-not-allowed opacity-60'}`}
            title={assignable ? undefined : 'Você não pode atribuir nem remover este papel (anti-escalonamento).'}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={checked}
              disabled={!assignable}
              onChange={(event) => toggle(code, event.target.checked)}
            />
            <span className="flex flex-col">
              <span className="flex items-center gap-2">
                <span className="font-medium">{role.name ?? code}</span>
                <code className="text-xs text-muted-foreground">{code}</code>
                {role.scope === 'TENANT' && <Badge variant="outline">do tenant</Badge>}
                {!assignable && <span className="text-xs text-muted-foreground">(não atribuível por você)</span>}
              </span>
              {role.description && <span className="text-xs text-muted-foreground">{role.description}</span>}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
