import { type KeyboardEvent, type ReactNode, useId, useRef } from 'react'

import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: string
  content: ReactNode
}

/** Abas acessíveis (padrão WAI-ARIA: setas, Home e End), controladas por quem usa (ex.: a aba na URL). */
export function Tabs({
  label,
  items,
  value,
  onValueChange,
}: {
  label: string
  items: TabItem[]
  value: string
  onValueChange: (value: string) => void
}) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  )

  function move(event: KeyboardEvent, current: number) {
    const last = items.length - 1
    const next =
      event.key === 'ArrowRight'
        ? current === last
          ? 0
          : current + 1
        : event.key === 'ArrowLeft'
          ? current === 0
            ? last
            : current - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : undefined
    if (next === undefined) {
      return
    }
    event.preventDefault()
    const target = items[next]
    if (target) {
      onValueChange(target.value)
      refs.current[next]?.focus()
    }
  }

  const active = items[index]
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={label} className="inline-flex w-fit gap-1 rounded-lg bg-muted p-1">
        {items.map((item, position) => (
          <button
            key={item.value}
            ref={(element) => {
              refs.current[position] = element
            }}
            type="button"
            role="tab"
            id={`${id}-${item.value}`}
            aria-selected={position === index}
            aria-controls={`${id}-${item.value}-painel`}
            tabIndex={position === index ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => move(event, position)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              position === index ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {active && (
        <div role="tabpanel" id={`${id}-${active.value}-painel`} aria-labelledby={`${id}-${active.value}`}>
          {active.content}
        </div>
      )}
    </div>
  )
}
