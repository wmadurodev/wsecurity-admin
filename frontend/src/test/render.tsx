import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'

import type { Session } from '@/lib/session'
import { createQueryClient } from '@/lib/query-client'
import { routes } from '@/routes/router'

import { server } from './server'

/** Responde `GET /bff/session` com a sessão indicada. */
export function withSession(session: Session) {
  server.use(http.get('/bff/session', () => HttpResponse.json(session)))
}

/** Renderiza a SPA inteira numa rota, com um QueryClient novo por teste. Devolve também o roteador. */
export function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...view, router }
}

/** Renderiza um componente com QueryClient e um roteador em memória. */
export function renderWithProviders(ui: ReactNode, path = '/') {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
