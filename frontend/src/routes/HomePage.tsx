import { useMutation, useQuery } from '@tanstack/react-query'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'

import { fetchSession, hasAdministrativeAccess, logout, SessionExpiredError, signInAgain } from '@/lib/session'

/**
 * Página inicial provisória (prompt 03): mostra a sessão do console e permite sair. O layout, a navegação e as telas
 * entram no prompt 05.
 */
export function HomePage() {
  const session = useQuery({ queryKey: ['session'], queryFn: fetchSession })
  const signOut = useMutation({ mutationFn: () => logout() })

  const expired = session.error instanceof SessionExpiredError
  useEffect(() => {
    // No Vite a página não passa pelo BFF: sem sessão, o login começa direto.
    if (expired && import.meta.env.DEV) {
      signInAgain(true)
    }
  }, [expired])

  const noAccess = session.data !== undefined && !hasAdministrativeAccess(session.data)
  useEffect(() => {
    if (noAccess) {
      window.location.assign('/no-access')
    }
  }, [noAccess])

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center gap-3">
        <ShieldCheck aria-hidden="true" className="size-8" />
        <h1 className="text-2xl font-semibold tracking-tight">wsecurity · Administração</h1>
      </header>

      {session.isPending && <p role="status">Carregando a sessão…</p>}

      {session.error instanceof SessionExpiredError && (
        <section role="alert" className="flex flex-col items-start gap-3">
          <p>Sua sessão expirou.</p>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => signInAgain()}
          >
            Entrar de novo
          </button>
        </section>
      )}

      {session.error && !(session.error instanceof SessionExpiredError) && (
        <p role="alert">Não foi possível carregar a sessão. Tente recarregar a página.</p>
      )}

      {session.data && (
        <section aria-labelledby="sessao" className="flex flex-col gap-4">
          <h2 id="sessao" className="text-lg font-medium">
            Sessão
          </h2>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Nome</dt>
            <dd>{session.data.name ?? '—'}</dd>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd>{session.data.email ?? '—'}</dd>
            <dt className="text-muted-foreground">Administrador da plataforma</dt>
            <dd>{session.data.platformAdmin ? 'sim' : 'não'}</dd>
          </dl>
          <h2 className="text-lg font-medium">Tenants</h2>
          {!session.data.tenantsAvailable && <p>Os tenants não puderam ser carregados agora.</p>}
          {session.data.tenantsAvailable && session.data.tenants.length === 0 && <p>Nenhum tenant administrável.</p>}
          <ul className="list-disc pl-6">
            {session.data.tenants.map((tenant) => (
              <li key={tenant.slug}>
                {tenant.name} <span className="text-muted-foreground">({tenant.slug})</span> —{' '}
                {tenant.roles.join(', ') || 'sem papéis'}
              </li>
            ))}
          </ul>
          <div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 disabled:opacity-50"
              disabled={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              <LogOut aria-hidden="true" className="size-4" />
              {signOut.isPending ? 'Saindo…' : 'Sair'}
            </button>
            {signOut.isError && <p role="alert">Não foi possível sair. Tente de novo.</p>}
          </div>
        </section>
      )}
    </main>
  )
}
