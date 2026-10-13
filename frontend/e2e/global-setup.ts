import { ensureDemoModule, ensureViewerRole } from './support/data'

/**
 * Catálogo compartilhado pelas jornadas (módulo `demo` e papel `viewer`), preparado uma vez antes dos workers: a
 * sincronização concorrente do mesmo módulo num ambiente novo falharia.
 */
export default async function globalSetup(): Promise<void> {
  await ensureDemoModule()
  await ensureViewerRole()
}
