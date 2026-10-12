/** Nome do cookie e do cabeçalho do CSRF no modo SPA do Spring Security (RNF-SEG-02). */
export const CSRF_COOKIE = 'XSRF-TOKEN'
export const CSRF_HEADER = 'X-XSRF-TOKEN'

/** Valor atual do token CSRF, lido do cookie (não é dado de sessão: é público para a origem). */
export function csrfToken(): string | undefined {
  const prefix = `${CSRF_COOKIE}=`
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix))
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined
}
