import { z } from 'zod'

import type { Client, ClientRequest } from './api'
import { days, minutes, toDays, toMinutes } from './durations'

export const GRANTS = [
  { value: 'authorization_code', label: 'Authorization code (login de usuários, com PKCE)' },
  { value: 'refresh_token', label: 'Refresh token' },
  { value: 'client_credentials', label: 'Client credentials (serviço, sem usuário)' },
] as const

export const AUTH_METHODS = [
  { value: 'client_secret_basic', label: 'Segredo no cabeçalho (client_secret_basic)' },
  { value: 'client_secret_post', label: 'Segredo no corpo (client_secret_post)' },
  { value: 'private_key_jwt', label: 'JWT assinado pela chave do cliente (private_key_jwt)' },
] as const

export const ADMIN_SCOPE = 'wsecurity.admin'
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]']

/** Regra do IdP para URIs de retorno (0001): https; http só em loopback; esquema próprio só para cliente público. */
export function isAllowedRedirectUri(value: string, type: 'PUBLIC' | 'CONFIDENTIAL'): boolean {
  if (value.includes('*') || value.includes('#')) {
    return false
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  const scheme = url.protocol.slice(0, -1).toLowerCase()
  if (scheme === 'https') {
    return url.hostname !== ''
  }
  if (scheme === 'http') {
    return LOOPBACK.includes(url.hostname.toLowerCase())
  }
  return type === 'PUBLIC' && scheme.includes('.')
}

export const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

export const clientSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome.').max(200, 'Use no máximo 200 caracteres.'),
    type: z.enum(['CONFIDENTIAL', 'PUBLIC']),
    authenticationMethod: z.enum(['client_secret_basic', 'client_secret_post', 'private_key_jwt']),
    jwkSetUrl: z.string(),
    authorizationCode: z.boolean(),
    refreshToken: z.boolean(),
    clientCredentials: z.boolean(),
    redirectUris: z.string(),
    postLogoutRedirectUris: z.string(),
    scopes: z.array(z.string()),
    allowedAdminScope: z.boolean(),
    firstParty: z.boolean(),
    revokeOnLogout: z.boolean(),
    accessTokenMinutes: z
      .number({ error: 'Informe um número.' })
      .min(1, 'Mínimo de 1 minuto.')
      .max(60, 'Máximo de 60 minutos.'),
    authorizationCodeMinutes: z
      .number({ error: 'Informe um número.' })
      .min(1, 'Mínimo de 1 minuto.')
      .max(10, 'Máximo de 10 minutos.'),
    refreshTokenDays: z.number({ error: 'Informe um número.' }).positive('Informe um valor positivo.'),
    refreshTokenIdleDays: z.number({ error: 'Informe um número.' }).positive('Informe um valor positivo.'),
    audiences: z.string(),
  })
  .superRefine((value, context) => {
    const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
    const usesUsers = value.authorizationCode
    if (!value.authorizationCode && !value.refreshToken && !value.clientCredentials) {
      issue('authorizationCode', 'Escolha pelo menos um grant.')
    }
    if (value.type === 'PUBLIC' && value.clientCredentials) {
      issue('clientCredentials', 'Cliente público não usa client credentials.')
    }
    if (value.type === 'PUBLIC' && value.refreshToken) {
      issue('refreshToken', 'Cliente público não recebe refresh token (0001/DEC-11).')
    }
    if (value.refreshToken && !value.authorizationCode) {
      issue('refreshToken', 'Refresh token exige authorization code.')
    }
    const redirects = lines(value.redirectUris)
    if (usesUsers && redirects.length === 0) {
      issue('redirectUris', 'Informe pelo menos uma URI de retorno.')
    }
    const invalid = [...redirects, ...lines(value.postLogoutRedirectUris)].filter(
      (uri) => !isAllowedRedirectUri(uri, value.type),
    )
    if (invalid.length > 0) {
      issue(
        lines(value.redirectUris).some((uri) => invalid.includes(uri)) ? 'redirectUris' : 'postLogoutRedirectUris',
        `URI inválida: ${invalid.join(', ')}. Use https (http só em localhost)${value.type === 'PUBLIC' ? ' ou um esquema próprio com ponto' : ''}.`,
      )
    }
    if (value.scopes.length === 0) {
      issue('scopes', 'Escolha pelo menos um escopo.')
    }
    if (value.scopes.includes('openid') && !value.authorizationCode) {
      issue('scopes', 'O escopo openid exige authorization code.')
    }
    if (value.scopes.includes(ADMIN_SCOPE) && !value.allowedAdminScope) {
      issue('scopes', 'Para usar wsecurity.admin, autorize explicitamente o escopo administrativo.')
    }
    if (
      value.type === 'CONFIDENTIAL' &&
      value.authenticationMethod === 'private_key_jwt' &&
      !value.jwkSetUrl.startsWith('https://')
    ) {
      issue('jwkSetUrl', 'private_key_jwt exige a URL https do JWKS do cliente.')
    }
    if (value.refreshTokenIdleDays > value.refreshTokenDays) {
      issue('refreshTokenIdleDays', 'A validade sem uso não pode passar da validade total.')
    }
  })

export type ClientValues = z.infer<typeof clientSchema>

export const NEW_CLIENT: ClientValues = {
  name: '',
  type: 'CONFIDENTIAL',
  authenticationMethod: 'client_secret_basic',
  jwkSetUrl: '',
  authorizationCode: true,
  refreshToken: true,
  clientCredentials: false,
  redirectUris: '',
  postLogoutRedirectUris: '',
  scopes: ['openid'],
  allowedAdminScope: false,
  firstParty: false,
  revokeOnLogout: true,
  accessTokenMinutes: 5,
  authorizationCodeMinutes: 5,
  refreshTokenDays: 30,
  refreshTokenIdleDays: 7,
  audiences: '',
}

export function valuesFromClient(client: Client): ClientValues {
  const grants = client.grantTypes ?? []
  const method = client.authenticationMethods?.find((item) => item !== 'none')
  const audiences = client.settings?.audiences
  return {
    name: client.name ?? '',
    type: client.type ?? 'CONFIDENTIAL',
    authenticationMethod: (AUTH_METHODS.some((item) => item.value === method)
      ? method
      : 'client_secret_basic') as ClientValues['authenticationMethod'],
    jwkSetUrl: client.jwkSetUrl ?? '',
    authorizationCode: grants.includes('authorization_code'),
    refreshToken: grants.includes('refresh_token'),
    clientCredentials: grants.includes('client_credentials'),
    redirectUris: (client.redirectUris ?? []).join('\n'),
    postLogoutRedirectUris: (client.postLogoutRedirectUris ?? []).join('\n'),
    scopes: client.scopes ?? [],
    allowedAdminScope: Boolean(client.allowedAdminScope),
    firstParty: Boolean(client.firstParty),
    revokeOnLogout: client.revokeOnLogout !== false,
    accessTokenMinutes: toMinutes(client.accessTokenTtl) ?? 5,
    authorizationCodeMinutes: toMinutes(client.authorizationCodeTtl) ?? 5,
    refreshTokenDays: toDays(client.refreshTokenTtl) ?? 30,
    refreshTokenIdleDays: toDays(client.refreshTokenIdleTtl) ?? 7,
    audiences: Array.isArray(audiences) ? (audiences as string[]).join('\n') : '',
  }
}

/** Corpo de `POST`/`PUT /clients`, preservando os demais `settings` do cliente na edição. */
export function requestFromValues(values: ClientValues, current?: Client): ClientRequest {
  const grantTypes = [
    values.authorizationCode && 'authorization_code',
    values.refreshToken && 'refresh_token',
    values.clientCredentials && 'client_credentials',
  ].filter((grant): grant is string => Boolean(grant))
  const settings: Record<string, unknown> = { ...(current?.settings ?? {}) }
  const audiences = lines(values.audiences)
  if (audiences.length > 0) {
    settings.audiences = audiences
  } else {
    delete settings.audiences
  }
  const confidential = values.type === 'CONFIDENTIAL'
  return {
    name: values.name.trim(),
    type: values.type,
    authenticationMethods: confidential ? [values.authenticationMethod] : ['none'],
    grantTypes,
    redirectUris: values.authorizationCode ? lines(values.redirectUris) : [],
    postLogoutRedirectUris: lines(values.postLogoutRedirectUris),
    scopes: values.scopes,
    firstParty: values.firstParty,
    allowedAdminScope: values.allowedAdminScope,
    revokeOnLogout: values.revokeOnLogout,
    accessTokenTtl: minutes(values.accessTokenMinutes),
    authorizationCodeTtl: minutes(values.authorizationCodeMinutes),
    refreshTokenTtl: days(values.refreshTokenDays),
    refreshTokenIdleTtl: days(values.refreshTokenIdleDays),
    jwkSetUrl: confidential && values.authenticationMethod === 'private_key_jwt' ? values.jwkSetUrl : undefined,
    settings,
  }
}

const VIOLATIONS: Record<string, string> = {
  'redirect-uri-required': 'Informe pelo menos uma URI de retorno.',
  'redirect-uri-invalid': 'URI de retorno inválida',
  'post-logout-redirect-uri-invalid': 'URI pós-logout inválida',
  'scopes-required': 'Escolha pelo menos um escopo.',
  'scope-unknown': 'Escopo desconhecido',
  'admin-scope-not-allowed': 'wsecurity.admin exige a autorização explícita do escopo administrativo.',
  'openid-requires-authorization-code': 'O escopo openid exige authorization code.',
  'refresh-token-requires-authorization-code': 'Refresh token exige authorization code.',
  'public-client-cannot-use-refresh-token': 'Cliente público não recebe refresh token.',
  'confidential-client-requires-authentication': 'Cliente confidencial precisa de um método de autenticação.',
  'private-key-jwt-requires-https-jwk-set-url': 'private_key_jwt exige a URL https do JWKS.',
  'access-token-ttl-invalid': 'Validade do access token inválida.',
  'authorization-code-ttl-invalid': 'Validade do código inválida.',
  'refresh-token-ttl-invalid': 'Validades do refresh token inválidas.',
}

/** Violações de `422 client-invalid-registration` (ex.: `scope-unknown:x`) em pt-BR. */
export function violationMessage(violation: string): string {
  const [code = violation, detail] = violation.split(/:(.*)/s)
  const text = VIOLATIONS[code] ?? code
  return detail ? `${text}: ${detail}` : text
}
