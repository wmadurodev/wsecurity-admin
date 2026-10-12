import { ShieldX } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

/** 403: o contexto ou a tela não está disponível para a sessão. */
export function ForbiddenPage() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <ShieldX className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-2xl font-semibold">Acesso negado</h1>
      <p className="max-w-md text-muted-foreground">Você não tem permissão para abrir esta área do console.</p>
      <Button variant="outline" onClick={() => window.history.back()}>
        Voltar
      </Button>
    </section>
  )
}

/** 404: rota desconhecida da SPA. */
export function NotFoundPage() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-muted-foreground">O endereço não corresponde a nenhuma tela do console.</p>
      <Link to="/" className="underline">
        Ir para o início
      </Link>
    </section>
  )
}
