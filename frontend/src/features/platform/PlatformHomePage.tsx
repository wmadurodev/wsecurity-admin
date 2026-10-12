import { Building2, LayoutGrid, Users } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/page-header'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const SHORTCUTS = [
  {
    to: '/platform/users',
    title: 'Usuários',
    description: 'Contas do IdP: busca, criação, bloqueio e acessos.',
    icon: Users,
  },
  {
    to: '/platform/tenants',
    title: 'Tenants',
    description: 'Clientes da plataforma, módulos contratados e status.',
    icon: Building2,
  },
  {
    to: '/platform/modules',
    title: 'Catálogo',
    description: 'Módulos, funcionalidades e papéis globais.',
    icon: LayoutGrid,
  },
]

/** Página inicial da plataforma, com atalhos (RF-NAV-03; painel com números fica para depois, Q-04). */
export function PlatformHomePage() {
  return (
    <>
      <PageHeader title="Plataforma" description="Administração do IdP e da autorização do wsecurity." />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.to}>
            <Link
              to={shortcut.to}
              className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader>
                  <shortcut.icon className="size-5" aria-hidden="true" />
                  <CardTitle>{shortcut.title}</CardTitle>
                  <CardDescription>{shortcut.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
