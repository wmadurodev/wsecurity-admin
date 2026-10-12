import { LogOut, Menu, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatches, useNavigate, type UIMatch } from 'react-router'

import { showProblem } from '@/components/problem-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { readPreference, writePreference } from '@/lib/preferences'
import { logout } from '@/lib/session'
import { useSession } from '@/lib/session-context'
import { cn } from '@/lib/utils'

import { contextFromPath, type NavItem, PLATFORM_NAV, tenantNav } from './navigation'

/** Trilha de uma rota: texto fixo ou calculado a partir dos parâmetros. */
export type Crumb = string | ((params: Record<string, string | undefined>) => string)

/** Estrutura das telas (RF-NAV-01): cabeçalho, barra lateral do contexto, trilha e avisos. */
export function AppLayout() {
  const { session, can } = useSession()
  const location = useLocation()
  const context = contextFromPath(location.pathname)
  const [collapsed, setCollapsed] = useState(readPreference('sidebarCollapsed') === 'true')

  const items: NavItem[] =
    context.kind === 'platform'
      ? PLATFORM_NAV
      : context.kind === 'tenant'
        ? tenantNav(context.slug).filter((item) => !item.permission || can(context.slug, item.permission))
        : []

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    writePreference('sidebarCollapsed', String(next))
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!collapsed}
          aria-controls="menu-lateral"
        >
          <Menu aria-hidden="true" />
        </Button>
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-5" aria-hidden="true" />
          wsecurity · Administração
        </Link>
        <ContextSelector />
        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="hidden flex-col text-right leading-tight md:flex">
            <span className="font-medium">{session.name ?? session.email}</span>
            <span className="text-xs text-muted-foreground">{session.email}</span>
          </div>
          <SignOutButton />
        </div>
      </header>
      <div className="flex flex-1">
        <nav
          id="menu-lateral"
          aria-label="Seções"
          className={cn('shrink-0 border-r p-2 transition-[width]', collapsed ? 'w-14' : 'w-60')}
        >
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent',
                      isActive && 'bg-accent font-medium',
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="conteudo" className="min-w-0 flex-1 p-6">
          <Notices />
          <Crumbs />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Seletor de contexto (RF-NAV-02): "Plataforma" para `wsecurity.admin` e os tenants administráveis da sessão. */
function ContextSelector() {
  const { session } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const id = useId()
  const context = contextFromPath(location.pathname)
  const current = context.kind === 'platform' ? 'platform' : context.kind === 'tenant' ? `t:${context.slug}` : ''
  const known = session.tenants.some((tenant) => context.kind === 'tenant' && tenant.slug === context.slug)

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Contexto
      </label>
      <Select
        id={id}
        value={current}
        className="w-56"
        onChange={(event) => {
          const value = event.target.value
          navigate(value === 'platform' ? '/platform' : `/t/${encodeURIComponent(value.slice(2))}`)
        }}
      >
        {current === '' && (
          <option value="" disabled>
            Escolha um contexto
          </option>
        )}
        {session.platformAdmin && <option value="platform">Plataforma</option>}
        {session.tenants.map((tenant) => (
          <option key={tenant.slug} value={`t:${tenant.slug}`}>
            {tenant.name}
          </option>
        ))}
        {context.kind === 'tenant' && !known && <option value={current}>{context.slug}</option>}
      </Select>
    </div>
  )
}

function SignOutButton() {
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        setPending(true)
        logout().catch((error: unknown) => {
          setPending(false)
          showProblem(error, 'Não foi possível sair')
        })
      }}
    >
      <LogOut aria-hidden="true" />
      {pending ? 'Saindo…' : 'Sair'}
    </Button>
  )
}

/** Avisos persistentes: sessão expirada (RF-AUT-05) e MFA do administrador da plataforma (RF-AUT-08). */
function Notices() {
  const { session, expired, signInAgain } = useSession()
  return (
    <div className="mb-4 flex flex-col gap-3 empty:hidden">
      {expired && (
        <Alert variant="destructive">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>Sua sessão expirou</AlertTitle>
          <AlertDescription>
            <p>Entre de novo para continuar. Você volta para esta mesma tela.</p>
            <Button size="sm" onClick={signInAgain}>
              Entrar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {session.platformAdmin && !session.mfa && (
        <Alert variant="warning">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>Ative o segundo fator de autenticação</AlertTitle>
          <AlertDescription>
            <p>
              Sua conta administra a plataforma inteira e entrou sem segundo fator.{' '}
              <a href={session.accountUrl} className="font-medium underline">
                Ativar na minha conta
              </a>
              .
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/** Trilha a partir do `handle.crumb` das rotas. */
function Crumbs() {
  const matches = useMatches() as UIMatch<unknown, { crumb?: Crumb } | undefined>[]
  const crumbs = matches
    .filter((match) => match.handle?.crumb)
    .map((match) => {
      const crumb = match.handle?.crumb as Crumb
      return { to: match.pathname, label: typeof crumb === 'function' ? crumb(match.params) : crumb }
    })
  if (crumbs.length === 0) {
    return null
  }
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <CrumbItem key={crumb.to} last={index === crumbs.length - 1} {...crumb} />
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function CrumbItem({ to, label, last }: { to: string; label: string; last: boolean }) {
  return (
    <>
      <BreadcrumbItem>
        {last ? (
          <BreadcrumbPage>{label}</BreadcrumbPage>
        ) : (
          <Link to={to} className="hover:text-foreground">
            {label}
          </Link>
        )}
      </BreadcrumbItem>
      {!last && <BreadcrumbSeparator />}
    </>
  )
}
