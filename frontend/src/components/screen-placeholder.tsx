import { Construction } from 'lucide-react'

import { PageHeader } from './page-header'
import { EmptyState } from './states'

/** Tela ainda não implementada: a estrutura e a rota existem; o conteúdo vem no prompt indicado. */
export function ScreenPlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Tela em construção"
        description="Esta área chega numa próxima etapa do console."
        action={<Construction className="size-5 text-muted-foreground" aria-hidden="true" />}
      />
    </>
  )
}
