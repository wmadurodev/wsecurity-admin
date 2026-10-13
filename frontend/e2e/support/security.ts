import type { Page } from '@playwright/test'

/** Valor com cara de JWT (`eyJ…` em três partes base64url). */
export const JWT = /eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]*/

/** Guarda os corpos de todas as respostas de `/bff/**` da página, para procurar tokens (RN-01). */
export function recordBffResponses(page: Page): string[] {
  const bodies: string[] = []
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname.startsWith('/bff/')) {
      bodies.push(`${response.url()}\n${JSON.stringify(response.headers())}\n${await response.text().catch(() => '')}`)
    }
  })
  return bodies
}

/** Registra as violações de CSP da página (evento `securitypolicyviolation`) em `window.__cspViolations`. */
export async function recordCspViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as unknown as { __cspViolations: string[] }
    target.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      target.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
}

/** Chamada ao BFF pela página, na sessão do navegador; com `csrf`, envia o cabeçalho como a SPA. */
export async function fetchFromPage(
  page: Page,
  method: string,
  path: string,
  options: { body?: unknown; csrf?: boolean } = {},
): Promise<number> {
  return page.evaluate(
    async ({ method, path, body, csrf }) => {
      const token = document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
        ?.split('=')[1]
      const response = await fetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(csrf && token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return response.status
    },
    { method, path, body: options.body, csrf: options.csrf ?? true },
  )
}
