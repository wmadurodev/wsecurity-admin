import { Building2 } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/page-header'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/lib/session-context'

/** Administrador de vários tenants escolhe em qual entrar (RF-NAV-03). */
export function TenantChooserPage() {
  const { session } = useSession()
  return (
    <>
      <PageHeader title="Escolha um tenant" description="Você administra mais de um tenant." />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {session.tenants.map((tenant) => (
          <li key={tenant.slug}>
            <Link
              to={`/t/${encodeURIComponent(tenant.slug)}`}
              className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader>
                  <Building2 className="size-5" aria-hidden="true" />
                  <CardTitle>{tenant.name}</CardTitle>
                  <CardDescription>
                    {tenant.slug} · {tenant.roles.join(', ') || 'sem papéis'}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
