import { CSRF_HEADER, csrfToken } from '../csrf'
import { toApiError } from './errors'
import type { paths as AuthzPaths } from './types/authz'
import type { paths as IdpPaths } from './types/idp'

/** Destinos do proxy do BFF (04 §3.2): `/bff/api/idp` → `/api/admin/v1` do IdP; `/bff/api/authz` → `/api` da autorização. */
const TARGETS = {
  idp: { bff: '/bff/api/idp', api: '/api/admin/v1' },
  authz: { bff: '/bff/api/authz', api: '/api' },
} as const

type Targets = typeof TARGETS
export type Target = keyof Targets
type Paths = { idp: IdpPaths; authz: AuthzPaths }
export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

type Strip<P, Prefix extends string> = P extends `${Prefix}${infer Rest}` ? Rest : never
/** Rotas do contrato, relativas ao destino (ex.: `/users/{id}`). */
export type Route<T extends Target> = Strip<keyof Paths[T], Targets[T]['api']>
type Operation<
  T extends Target,
  R extends Route<T>,
  M extends Method,
> = `${Targets[T]['api']}${R}` extends keyof Paths[T]
  ? NonNullable<Paths[T][`${Targets[T]['api']}${R}`][M & keyof Paths[T][`${Targets[T]['api']}${R}`]]>
  : never

type Content<C> = C extends { content: infer Body } ? Body[keyof Body] : undefined
/** Corpo da resposta de sucesso (200 ou 201) da operação, conforme o contrato. */
export type ResponseBody<O> = O extends { responses: infer R }
  ? 200 extends keyof R
    ? Content<R[200]>
    : 201 extends keyof R
      ? Content<R[201]>
      : undefined
  : never
/** Corpo da requisição da operação, conforme o contrato. */
export type RequestBody<O> = O extends { requestBody?: infer B } ? Content<NonNullable<B>> : never

export type QueryValue = string | number | boolean | undefined | null | readonly (string | number)[]

export interface RequestOptions<B = unknown> {
  /** Valores das variáveis do caminho (`{id}` etc.), codificados com `encodeURIComponent`. */
  path?: Record<string, string>
  query?: Record<string, QueryValue>
  body?: B
  /** Versão lida (`ETag`), enviada em `If-Match` (RF-NAV-07). */
  ifMatch?: string
  contentType?: string
  signal?: AbortSignal
}

export interface ApiResponse<T> {
  data: T
  status: number
  etag: string | undefined
  location: string | undefined
}

type UnauthorizedListener = () => void
const unauthorizedListeners = new Set<UnauthorizedListener>()

/** Avisado a cada `401` do BFF: a sessão expirou (RF-AUT-05). */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

export function buildUrl(target: Target, route: string, options: Pick<RequestOptions, 'path' | 'query'> = {}): string {
  const path = route.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = options.path?.[name]
    if (value === undefined) {
      throw new Error(`Variável de caminho ausente: ${name}`)
    }
    return encodeURIComponent(value)
  })
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(name, String(item))
    }
  }
  const query = params.toString()
  return `${TARGETS[target].bff}${path}${query ? `?${query}` : ''}`
}

/** Chamada ao proxy do BFF com cookie de sessão e CSRF (RNF-SEG-02). Erros viram {@link ApiError}. */
export async function request<T>(method: Method, url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'get') {
    const token = csrfToken()
    if (token) {
      headers[CSRF_HEADER] = token
    }
  }
  if (options.ifMatch) {
    headers['If-Match'] = options.ifMatch
  }
  let body: string | undefined
  if (options.body !== undefined) {
    headers['Content-Type'] = options.contentType ?? 'application/json'
    body = JSON.stringify(options.body)
  }
  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body,
    credentials: 'same-origin',
    signal: options.signal,
  })
  if (response.status === 401) {
    unauthorizedListeners.forEach((listener) => listener())
  }
  if (!response.ok) {
    throw await toApiError(response)
  }
  const text = response.status === 204 ? '' : await response.text()
  return {
    data: (text ? JSON.parse(text) : undefined) as T,
    status: response.status,
    etag: response.headers.get('ETag') ?? undefined,
    location: response.headers.get('Location') ?? undefined,
  }
}

function client<T extends Target>(target: T) {
  const call =
    <M extends Method>(method: M) =>
    <R extends Route<T>>(route: R, options: RequestOptions<RequestBody<Operation<T, R, M>>> = {}) =>
      request<ResponseBody<Operation<T, R, M>>>(method, buildUrl(target, route, options), options)
  return {
    get: call('get'),
    post: call('post'),
    put: call('put'),
    patch: call('patch'),
    delete: call('delete'),
  }
}

/** API administrativa do IdP pelo BFF, tipada pelo contrato `openapi/idp.json`. */
export const idp = client('idp')
/** API da autorização pelo BFF, tipada pelo contrato `openapi/authz.json`. */
export const authz = client('authz')

/** Página das listas das APIs (0001 e 0002, RNF-API-05). */
export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
