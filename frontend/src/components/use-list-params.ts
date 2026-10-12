import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { readPreference, writePreference } from '@/lib/preferences'

export const PAGE_SIZES = [10, 20, 50, 100] as const
const DEFAULT_SIZE = 20

export interface ListParams {
  page: number
  size: number
  sort: string | undefined
  /** Filtro ou busca da URL. */
  get: (name: string) => string | undefined
  /** Altera filtros na URL; a página volta para a primeira, exceto quando `page` é informado. */
  set: (updates: Record<string, string | number | undefined>) => void
  /** Parâmetros para a API: `page`, `size`, `sort` e os filtros. */
  query: Record<string, string | number>
}

/** Paginação, ordenação, filtros e busca sincronizados com a URL (RF-NAV-04). */
export function useListParams(defaults: { sort?: string } = {}): ListParams {
  const [params, setParams] = useSearchParams()
  const preferred = Number(readPreference('pageSize'))
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0)
  const sizeParam = Number(params.get('size'))
  const size = PAGE_SIZES.includes(sizeParam as (typeof PAGE_SIZES)[number])
    ? sizeParam
    : PAGE_SIZES.includes(preferred as (typeof PAGE_SIZES)[number])
      ? preferred
      : DEFAULT_SIZE
  const sort = params.get('sort') ?? defaults.sort

  const set = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [name, value] of Object.entries(updates)) {
            if (value === undefined || value === '') {
              next.delete(name)
            } else {
              next.set(name, String(value))
            }
          }
          if (!('page' in updates)) {
            next.delete('page')
          }
          if ('size' in updates && updates.size !== undefined) {
            writePreference('pageSize', String(updates.size))
          }
          return next
        },
        { replace: false },
      )
    },
    [setParams],
  )

  return useMemo(() => {
    const query: Record<string, string | number> = { page, size }
    if (sort) {
      query.sort = sort
    }
    params.forEach((value, name) => {
      if (!['page', 'size', 'sort'].includes(name) && value) {
        query[name] = value
      }
    })
    return { page, size, sort, get: (name: string) => params.get(name) ?? undefined, set, query }
  }, [page, size, sort, params, set])
}
