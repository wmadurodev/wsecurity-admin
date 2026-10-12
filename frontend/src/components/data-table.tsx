import type { UseQueryResult } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { type FormEvent, type ReactNode, useId, useState } from 'react'

import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Page } from '@/lib/api/client'

import { type ListParams, PAGE_SIZES } from './use-list-params'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Campo de ordenação aceito pela API (`sort=<campo>,asc|desc`); sem ele, a coluna não ordena. */
  sortBy?: string
  className?: string
}

export interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  query: UseQueryResult<Page<T>>
  params: ListParams
  rowKey: (row: T) => string
  empty: { title: string; description?: ReactNode; action?: ReactNode }
  /** Nome do parâmetro de busca da API (ex.: `email`); sem ele, não há campo de busca. */
  search?: { param: string; label: string; placeholder?: string }
  /** Filtros extras, que usam `params.set`. */
  filters?: ReactNode
}

/** Lista paginada no servidor com busca, filtros e ordenação na URL e estados de carregamento, vazio e erro (RF-NAV-04). */
export function DataTable<T>({ caption, columns, query, params, rowKey, empty, search, filters }: DataTableProps<T>) {
  const searchId = useId()
  const sizeId = useId()
  const [term, setTerm] = useState(search ? (params.get(search.param) ?? '') : '')

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    if (search) {
      params.set({ [search.param]: term.trim() || undefined })
    }
  }

  function toggleSort(field: string) {
    const [current, direction] = (params.sort ?? '').split(',')
    params.set({ sort: current === field && direction === 'asc' ? `${field},desc` : `${field},asc` })
  }

  const page = query.data
  return (
    <div className="flex flex-col gap-4">
      {(search || filters) && (
        <div className="flex flex-wrap items-end gap-3">
          {search && (
            <form role="search" onSubmit={submitSearch} className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={searchId} className="text-sm font-medium">
                  {search.label}
                </label>
                <Input
                  id={searchId}
                  value={term}
                  placeholder={search.placeholder}
                  onChange={(event) => setTerm(event.target.value)}
                  className="w-64"
                />
              </div>
              <Button type="submit" variant="outline">
                <Search aria-hidden="true" />
                Buscar
              </Button>
            </form>
          )}
          {filters}
        </div>
      )}

      {query.isPending && <LoadingState />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {page && page.content.length === 0 && <EmptyState {...empty} />}
      {page && page.content.length > 0 && (
        <>
          <Table>
            <TableCaption className="sr-only">{caption}</TableCaption>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={column.className}
                    aria-sort={ariaSort(params.sort, column.sortBy)}
                  >
                    {column.sortBy ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:underline"
                        onClick={() => toggleSort(column.sortBy as string)}
                      >
                        {column.header}
                        <SortIcon sort={params.sort} field={column.sortBy} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.content.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              {page.totalElements} {page.totalElements === 1 ? 'item' : 'itens'} · página {page.page + 1} de{' '}
              {Math.max(page.totalPages, 1)}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor={sizeId} className="text-muted-foreground">
                Por página
              </label>
              <Select
                id={sizeId}
                value={params.size}
                onChange={(event) => params.set({ size: Number(event.target.value) })}
                className="w-20"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
              <Button
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                disabled={page.page <= 0}
                onClick={() => params.set({ page: page.page - 1 })}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Próxima página"
                disabled={page.page + 1 >= page.totalPages}
                onClick={() => params.set({ page: page.page + 1 })}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  )
}

function ariaSort(sort: string | undefined, field: string | undefined): 'ascending' | 'descending' | undefined {
  if (!field || !sort?.startsWith(`${field},`)) {
    return undefined
  }
  return sort.endsWith(',desc') ? 'descending' : 'ascending'
}

function SortIcon({ sort, field }: { sort: string | undefined; field: string }) {
  const direction = ariaSort(sort, field)
  if (direction === 'ascending') {
    return <ArrowUp className="size-3.5" aria-hidden="true" />
  }
  if (direction === 'descending') {
    return <ArrowDown className="size-3.5" aria-hidden="true" />
  }
  return <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />
}
