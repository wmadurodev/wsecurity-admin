import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { server } from './server'

// As telas são rotas carregadas sob demanda (lazy): com a suíte inteira rodando em paralelo, o primeiro render de um
// arquivo pode passar de 1 s, o padrão do findBy*/waitFor. 3 s evita falhas intermitentes e fica abaixo do limite de
// 5 s por teste do Vitest.
configure({ asyncUtilTimeout: 3_000 })

// O jsdom não implementa o modal do <dialog>: basta abrir/fechar e disparar o evento de fechamento.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})
afterAll(() => server.close())
