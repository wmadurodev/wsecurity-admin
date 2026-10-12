import { formatDateTime } from '@/lib/format'

/** Data e hora no fuso do navegador, `dd/MM/yyyy HH:mm` (RNF-UX-01). */
export function DateTime({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>
  }
  return <time dateTime={value}>{formatDateTime(value)}</time>
}
