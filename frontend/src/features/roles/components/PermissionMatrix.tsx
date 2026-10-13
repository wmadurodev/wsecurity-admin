import { Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type Access = 'READ' | 'WRITE'

export interface Grant {
  feature: string
  access: Access
}

/** Funcionalidade disponível para concessão, com o módulo e a categoria para o agrupamento. */
export interface MatrixFeature {
  code: string
  name: string
  module: string
  moduleName: string
  category?: string
  /** Funcionalidade (ou módulo) desabilitada no catálogo: não aceita concessão nova. */
  enabled: boolean
}

const LEVELS: { value: Access | 'NONE'; label: string }[] = [
  { value: 'NONE', label: 'Sem acesso' },
  { value: 'READ', label: 'Leitura' },
  { value: 'WRITE', label: 'Escrita' },
]

/**
 * Editor de concessões de um papel (RF-ROL-03). Por funcionalidade, um grupo de opções nativo ("sem acesso",
 * `READ`, `WRITE`), navegável pelas setas. Opções negadas por `canGrant` ficam desabilitadas com a dica
 * `deniedHint` (anti-escalonamento, 0002/RN-07). Concessões de funcionalidades fora da lista são preservadas.
 */
export function PermissionMatrix({
  features,
  grants,
  onChange,
  canGrant = () => true,
  deniedHint = 'Você não tem esta permissão para conceder.',
  readOnly = false,
}: {
  features: MatrixFeature[]
  grants: Grant[]
  onChange?: (grants: Grant[]) => void
  canGrant?: (feature: string, access: Access) => boolean
  deniedHint?: string
  readOnly?: boolean
}) {
  const id = useId()
  const [filter, setFilter] = useState('')
  const current = useMemo(() => new Map(grants.map((grant) => [grant.feature, grant.access])), [grants])

  const groups = useMemo(() => {
    const term = filter.trim().toLowerCase()
    const visible = features.filter(
      (feature) => !term || feature.code.toLowerCase().includes(term) || feature.name.toLowerCase().includes(term),
    )
    const modules = new Map<string, { name: string; categories: Map<string, MatrixFeature[]>; total: number }>()
    for (const feature of [...visible].sort((a, b) => a.code.localeCompare(b.code))) {
      const module = modules.get(feature.module) ?? { name: feature.moduleName, categories: new Map(), total: 0 }
      const category = feature.category?.trim() || 'Geral'
      module.categories.set(category, [...(module.categories.get(category) ?? []), feature])
      module.total += 1
      modules.set(feature.module, module)
    }
    return [...modules.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [features, filter])

  function choose(feature: string, level: Access | 'NONE') {
    const next = grants.filter((grant) => grant.feature !== feature)
    if (level !== 'NONE') {
      next.push({ feature, access: level })
    }
    onChange?.(next)
  }

  const granted = (module: string) =>
    features.filter((feature) => feature.module === module && current.has(feature.code)).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-sm flex-col gap-1.5">
        <label htmlFor={`${id}-filtro`} className="text-sm font-medium">
          Filtrar funcionalidades
        </label>
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${id}-filtro`}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      {groups.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma funcionalidade encontrada.</p>}
      {groups.map(([module, group]) => (
        <section key={module} aria-labelledby={`${id}-${module}`} className="rounded-lg border">
          <header className="flex items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2">
            <h3 id={`${id}-${module}`} className="font-medium">
              {group.name}{' '}
              {group.name !== module && <span className="font-mono text-xs text-muted-foreground">{module}</span>}
            </h3>
            <span
              className="text-xs text-muted-foreground"
              aria-label={`${granted(module)} de ${group.total} com acesso`}
            >
              {granted(module)}/{group.total}
            </span>
          </header>
          {[...group.categories.entries()].map(([category, items]) => (
            <div key={category} className="px-4 py-2">
              <h4 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{category}</h4>
              <ul className="divide-y">
                {items.map((feature) => {
                  const selected = current.get(feature.code) ?? 'NONE'
                  const hintId = `${id}-${feature.code}-dica`
                  const anyDenied = LEVELS.some(
                    (level) => level.value !== 'NONE' && !canGrant(feature.code, level.value),
                  )
                  // Concessão atual que o chamador não possui: ele também não pode retirá-la (0002/RN-07).
                  const locked = selected !== 'NONE' && !canGrant(feature.code, selected)
                  return (
                    <li key={feature.code} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-48">
                        <span className="text-sm">{feature.name}</span>{' '}
                        {/* Sem o catálogo o nome é o próprio código: não repete. */}
                        {feature.name !== feature.code && (
                          <code className="text-xs text-muted-foreground">{feature.code}</code>
                        )}
                        {!feature.enabled && (
                          <Badge variant="secondary" className="ml-2">
                            desabilitada
                          </Badge>
                        )}
                        {anyDenied && !readOnly && (
                          <p id={hintId} className="text-xs text-muted-foreground">
                            {deniedHint}
                          </p>
                        )}
                      </div>
                      <div
                        role="radiogroup"
                        aria-label={`Acesso a ${feature.name}`}
                        aria-describedby={anyDenied ? hintId : undefined}
                        className="inline-flex rounded-md border p-0.5"
                      >
                        {LEVELS.map((level) => {
                          const denied =
                            (locked && level.value !== selected) ||
                            (level.value !== 'NONE' &&
                              level.value !== selected &&
                              (!canGrant(feature.code, level.value) || !feature.enabled))
                          return (
                            <label
                              key={level.value}
                              title={
                                denied
                                  ? feature.enabled
                                    ? deniedHint
                                    : 'Funcionalidade desabilitada no catálogo.'
                                  : undefined
                              }
                              className={cn(
                                'cursor-pointer rounded px-2 py-1 text-xs has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
                                (denied || readOnly) && 'cursor-not-allowed opacity-50',
                              )}
                            >
                              <input
                                type="radio"
                                className="sr-only"
                                name={`${id}-${feature.code}`}
                                value={level.value}
                                checked={selected === level.value}
                                disabled={denied || readOnly}
                                onChange={() => choose(feature.code, level.value)}
                              />
                              {level.label}
                            </label>
                          )
                        })}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
