import { useQuery } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { listUsers, type User, userKeys } from './api'

/**
 * Autocompletar de usuários do IdP por e-mail (`GET /bff/api/idp/users?email=`), no padrão combobox da WAI-ARIA.
 * Só para a área da plataforma: administradores de tenant não consultam o IdP.
 */
export function UserPicker({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id?: string
  value: User | null
  onChange: (user: User | null) => void
  invalid?: boolean
  describedBy?: string
}) {
  const generated = useId()
  const inputId = id ?? generated
  const listId = `${inputId}-opcoes`
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(timer)
  }, [term])

  const query = { email: debounced, size: 8, sort: 'email,asc' }
  const users = useQuery({
    queryKey: userKeys.list(query),
    queryFn: () => listUsers(query),
    enabled: debounced.length >= 2,
  })
  const options = (users.data?.content ?? []).filter((user) => user.status !== 'DELETED')

  function pick(user: User) {
    onChange(user)
    setTerm('')
    setOpen(false)
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((current) => Math.min(current + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && open && options[active]) {
      event.preventDefault()
      pick(options[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
        <span>
          <span className="font-medium">{value.name}</span> <span className="text-muted-foreground">{value.email}</span>
        </span>
        <Button variant="ghost" size="icon" aria-label="Trocar o usuário escolhido" onClick={() => onChange(null)}>
          <X aria-hidden="true" />
        </Button>
      </div>
    )
  }

  const expanded = open && debounced.length >= 2
  return (
    <div className="relative">
      <Input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && options[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder="Digite parte do e-mail"
        value={term}
        onChange={(event) => {
          setTerm(event.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={keyDown}
      />
      {expanded && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {users.isFetching && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Buscando…
            </div>
          )}
          {!users.isFetching && options.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
          )}
          {options.map((user, index) => (
            <div
              key={user.id}
              id={`${listId}-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              className={cn('cursor-pointer rounded px-2 py-1.5 text-sm', index === active && 'bg-accent')}
              onMouseDown={(event) => {
                event.preventDefault()
                pick(user)
              }}
            >
              <span className="font-medium">{user.name}</span>{' '}
              <span className="text-muted-foreground">{user.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
