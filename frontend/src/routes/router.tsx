import type { ComponentType } from 'react'
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router'
import { Toaster } from 'sonner'

import { AppLayout, type Crumb } from '@/components/layout/AppLayout'
import { LoadingState } from '@/components/states'
import { SessionProvider } from '@/lib/session-context'

import { HomeRedirect, PlatformGuard, RequirePermission, TenantGuard } from './guards'
import { NotFoundPage } from './pages'

/** Página de uma área carregada sob demanda (RNF-DES-02). */
function page<M>(load: () => Promise<M>, pick: (module: M) => ComponentType) {
  return async () => ({ Component: pick(await load()) })
}

const users = () => import('@/features/users/pages')
const clients = () => import('@/features/clients/pages')
const catalog = () => import('@/features/catalog/pages')
const roles = () => import('@/features/roles/pages')
const tenants = () => import('@/features/tenants/pages')
const tenant = () => import('@/features/tenant/pages')
const platform = () => import('@/features/platform/PlatformHomePage')

const crumb = (value: Crumb) => ({ crumb: value })

export const routes: RouteObject[] = [
  {
    element: (
      <>
        <SessionProvider fallback={<LoadingState label="Carregando a sessão…" />}>
          <Outlet />
        </SessionProvider>
        <Toaster richColors closeButton />
      </>
    ),
    hydrateFallbackElement: <LoadingState />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          {
            path: 'platform',
            element: <PlatformGuard />,
            handle: crumb('Plataforma'),
            children: [
              { index: true, lazy: page(platform, (m) => m.PlatformHomePage) },
              {
                path: 'users',
                handle: crumb('Usuários'),
                children: [
                  { index: true, lazy: page(users, (m) => m.UsersPage) },
                  { path: ':id', handle: crumb('Usuário'), lazy: page(users, (m) => m.UserDetailPage) },
                ],
              },
              {
                path: 'clients',
                handle: crumb('Clientes OAuth'),
                children: [
                  { index: true, lazy: page(clients, (m) => m.ClientsPage) },
                  { path: 'new', handle: crumb('Novo cliente'), lazy: page(clients, (m) => m.NewClientPage) },
                  {
                    path: ':clientId',
                    handle: crumb((params) => params.clientId ?? 'Cliente'),
                    lazy: page(clients, (m) => m.ClientDetailPage),
                  },
                ],
              },
              { path: 'scopes', handle: crumb('Escopos'), lazy: page(clients, (m) => m.ScopesPage) },
              { path: 'keys', handle: crumb('Chaves'), lazy: page(clients, (m) => m.KeysPage) },
              {
                path: 'modules',
                handle: crumb('Módulos'),
                children: [
                  { index: true, lazy: page(catalog, (m) => m.ModulesPage) },
                  {
                    path: ':code',
                    handle: crumb((params) => params.code ?? 'Módulo'),
                    lazy: page(catalog, (m) => m.ModuleDetailPage),
                  },
                ],
              },
              {
                path: 'roles',
                handle: crumb('Papéis globais'),
                children: [
                  { index: true, lazy: page(roles, (m) => m.GlobalRolesPage) },
                  { path: 'new', handle: crumb('Novo papel'), lazy: page(roles, (m) => m.NewGlobalRolePage) },
                  {
                    path: ':code',
                    handle: crumb((params) => params.code ?? 'Papel'),
                    lazy: page(roles, (m) => m.GlobalRoleDetailPage),
                  },
                ],
              },
              {
                path: 'tenants',
                handle: crumb('Tenants'),
                children: [
                  { index: true, lazy: page(tenants, (m) => m.TenantsPage) },
                  { path: 'new', handle: crumb('Novo tenant'), lazy: page(tenants, (m) => m.NewTenantPage) },
                  {
                    path: ':slug',
                    handle: crumb((params) => params.slug ?? 'Tenant'),
                    lazy: page(tenants, (m) => m.PlatformTenantPage),
                  },
                ],
              },
              { path: 'audit', handle: crumb('Auditoria'), lazy: page(tenants, (m) => m.PlatformAuditPage) },
            ],
          },
          {
            path: 't/:slug',
            element: <TenantGuard />,
            handle: crumb((params) => params.slug ?? 'Tenant'),
            children: [
              {
                element: <RequirePermission permission="core.tenant:read" />,
                children: [{ index: true, lazy: page(tenant, (m) => m.TenantOverviewPage) }],
              },
              {
                path: 'members',
                element: <RequirePermission permission="core.members:read" />,
                handle: crumb('Membros'),
                children: [
                  { index: true, lazy: page(tenant, (m) => m.MembersPage) },
                  {
                    path: ':subject',
                    handle: crumb('Membro'),
                    lazy: page(tenant, (m) => m.MemberDetailPage),
                  },
                ],
              },
              {
                path: 'roles',
                element: <RequirePermission permission="core.roles:read" />,
                handle: crumb('Papéis'),
                children: [
                  { index: true, lazy: page(tenant, (m) => m.TenantRolesPage) },
                  {
                    path: ':code',
                    handle: crumb((params) => params.code ?? 'Papel'),
                    lazy: page(tenant, (m) => m.TenantRoleDetailPage),
                  },
                ],
              },
              {
                path: 'audit',
                element: <RequirePermission permission="core.audit:read" />,
                handle: crumb('Auditoria'),
                children: [{ index: true, lazy: page(tenant, (m) => m.TenantAuditPage) }],
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export function createRouter() {
  return createBrowserRouter(routes)
}
