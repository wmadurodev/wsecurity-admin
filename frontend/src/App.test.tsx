import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { routes } from '@/routes/router'

describe('SPA (fumaça)', () => {
  it.each(['/', '/qualquer/rota'])('mostra a página provisória em %s', (path) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] })
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('heading', { level: 1, name: 'wsecurity · Administração' })).toBeInTheDocument()
  })
})
