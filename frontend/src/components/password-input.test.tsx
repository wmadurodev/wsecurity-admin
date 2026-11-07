import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { PasswordInput } from '@/components/ui/password-input'

/** Campo de senha com mostrar/ocultar (0006/RF-SEN-06, RNF-ACE-01). */
describe('PasswordInput', () => {
  const renderField = () =>
    render(
      <>
        <label htmlFor="secret">Senha inicial</label>
        <PasswordInput id="secret" autoComplete="new-password" aria-invalid={false} />
      </>,
    )

  it('começa oculto e alterna com o botão, que informa o estado', async () => {
    renderField()
    const field = screen.getByLabelText('Senha inicial')
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(field).toHaveAttribute('type', 'password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'secret')
    expect(toggle).toHaveAttribute('type', 'button')

    await userEvent.type(field, 'frase secreta 2026')
    await userEvent.click(toggle)
    expect(field).toHaveAttribute('type', 'text')
    expect(field).toHaveValue('frase secreta 2026')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(field).toHaveAttribute('type', 'password')
  })

  it('repassa as props ao campo e é alcançável pelo teclado', async () => {
    renderField()
    const field = screen.getByLabelText('Senha inicial')
    expect(field).toHaveAttribute('autocomplete', 'new-password')
    expect(field).toHaveAttribute('aria-invalid', 'false')

    await userEvent.click(field)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(field).toHaveAttribute('type', 'text')
  })

  it('volta a oculto quando é montado de novo', async () => {
    const { unmount } = renderField()
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    unmount()
    renderField()
    expect(screen.getByLabelText('Senha inicial')).toHaveAttribute('type', 'password')
  })
})
