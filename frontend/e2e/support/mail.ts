import { type APIRequestContext } from '@playwright/test'

import { env } from './env'

/**
 * Link do IdP no e-mail mais recente para `to` com o assunto dado, lido pela API do Mailpit. Espera o outbox do IdP
 * entregar (até ~30 s).
 */
export async function mailLink(request: APIRequestContext, to: string, subject: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const search = await (
      await request.get(`${env.mailpit}/api/v1/search`, { params: { query: `to:"${to}" subject:"${subject}"` } })
    ).json()
    const id = search.messages?.[0]?.ID
    if (id) {
      const text: string = (await (await request.get(`${env.mailpit}/api/v1/message/${id}`)).json()).Text ?? ''
      const link = text.match(new RegExp(`${env.idp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/account/[^\\s]+`))
      if (link) {
        return link[0]
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`E-mail "${subject}" para ${to} não chegou ao Mailpit (${env.mailpit}).`)
}
