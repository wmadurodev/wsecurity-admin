import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SessionProvider } from '@/lib/session-context'
import { adminSession, limitedSession } from '@/test/fixtures'
import { renderWithProviders, withSession } from '@/test/render'

import { PermissionGate } from './permission-gate'

function Actions() {
  return (
    <SessionProvider>
      <PermissionGate tenant="padaria" permission="core.members:write" fallback={<span>somente leitura</span>}>
        <button type="button">Adicionar membro</button>
      </PermissionGate>
    </SessionProvider>
  )
}

describe('PermissionGate', () => {
  it('esconde a ação sem a permissão no tenant', async () => {
    withSession(limitedSession)
    renderWithProviders(<Actions />)
    expect(await screen.findByText('somente leitura')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar membro' })).not.toBeInTheDocument()
  })

  it('o administrador da plataforma vê todas as ações', async () => {
    withSession(adminSession)
    renderWithProviders(<Actions />)
    expect(await screen.findByRole('button', { name: 'Adicionar membro' })).toBeInTheDocument()
  })
})
