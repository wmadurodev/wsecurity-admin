import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { adminSession } from '@/test/fixtures'
import { renderAt } from '@/test/render'
import { server } from '@/test/server'

describe('HomePage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  it('mostra os dados da sessão e os tenants', async () => {
    server.use(http.get('/bff/session', () => HttpResponse.json(adminSession)))
    renderAt('/')
    expect(await screen.findByText('ana@exemplo.com')).toBeInTheDocument()
    expect(screen.getByText('sim')).toBeInTheDocument()
    expect(screen.getByText(/Acme/)).toBeInTheDocument()
  })

  it('avisa que a sessão expirou quando o BFF responde 401', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign })
    server.use(http.get('/bff/session', () => new HttpResponse(null, { status: 401 })))
    renderAt('/')
    expect(await screen.findByText('Sua sessão expirou.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar de novo' })).toBeInTheDocument()
    // No Vite (desenvolvimento, como nos testes) o login começa direto.
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/oauth2/authorization/wsecurity'))
  })

  it('leva à página sem acesso quando não há plataforma nem tenants', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign })
    server.use(
      http.get('/bff/session', () => HttpResponse.json({ ...adminSession, platformAdmin: false, tenants: [] })),
    )
    renderAt('/')
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/no-access'))
  })

  it('sai com o cabeçalho CSRF e segue para o logout do IdP', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign })
    document.cookie = 'XSRF-TOKEN=token-csrf'
    let header: string | null = null
    server.use(
      http.get('/bff/session', () => HttpResponse.json(adminSession)),
      http.post('/bff/logout', ({ request }) => {
        header = request.headers.get('X-XSRF-TOKEN')
        return HttpResponse.json({ redirectUrl: 'http://localhost:9000/connect/logout?id_token_hint=x' })
      }),
    )
    renderAt('/')
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('http://localhost:9000/connect/logout?id_token_hint=x'))
    expect(header).toBe('token-csrf')
  })
})

describe('signInAgain', () => {
  afterEach(() => vi.restoreAllMocks())

  it('no Vite começa o login direto; servida pelo BFF, recarrega a página', async () => {
    const { signInAgain, LOGIN_URL } = await import('@/lib/session')
    const assign = vi.fn()
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign, reload })
    signInAgain(true)
    expect(assign).toHaveBeenCalledWith(LOGIN_URL)
    signInAgain(false)
    expect(reload).toHaveBeenCalled()
  })
})
