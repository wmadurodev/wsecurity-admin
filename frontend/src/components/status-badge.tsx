import { Badge } from '@/components/ui/badge'

const STATUS: Record<
  string,
  { label: string; variant: 'success' | 'secondary' | 'warning' | 'destructive' | 'outline' }
> = {
  ACTIVE: { label: 'Ativo', variant: 'success' },
  ENABLED: { label: 'Ativo', variant: 'success' },
  DISABLED: { label: 'Desativado', variant: 'secondary' },
  LOCKED: { label: 'Bloqueado', variant: 'warning' },
  SUSPENDED: { label: 'Suspenso', variant: 'warning' },
  PENDING: { label: 'Pendente', variant: 'outline' },
  INVITED: { label: 'Convidado', variant: 'outline' },
  PENDING_VERIFICATION: { label: 'Aguardando verificação', variant: 'outline' },
  EXPIRED: { label: 'Expirado', variant: 'secondary' },
  REVOKED: { label: 'Revogado', variant: 'secondary' },
  RETIRED: { label: 'Aposentada', variant: 'secondary' },
  NEXT: { label: 'Próxima', variant: 'outline' },
  DELETED: { label: 'Excluído', variant: 'destructive' },
}

/** Situação de um registro, com rótulo em pt-BR. */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return <span className="text-muted-foreground">—</span>
  }
  const known = STATUS[status.toUpperCase()]
  return <Badge variant={known?.variant ?? 'outline'}>{known?.label ?? status}</Badge>
}
