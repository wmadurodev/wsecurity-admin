import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { adminSession } from '@/test/fixtures'
import { renderAt } from '@/test/render'
import { server } from '@/test/server'

describe('SPA (fumaça)', () => {
  it.each(['/', '/qualquer/rota'])('mostra o título em %s', async (path) => {
    server.use(http.get('/bff/session', () => HttpResponse.json(adminSession)))
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: 'wsecurity · Administração' })).toBeInTheDocument()
    expect(await screen.findByText('Ana Admin')).toBeInTheDocument()
  })
})
