import { setupServer } from 'msw/node'

/** Servidor MSW dos testes; cada teste registra os handlers de que precisa com server.use(...). */
export const server = setupServer()
