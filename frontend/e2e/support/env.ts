/** Endereços e credenciais do ambiente, vindos do make e2e-admin (padrões: portas do wsecurity-infra). */
export const env = {
  baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:9200',
  idp: process.env.E2E_IDP_URL ?? 'http://localhost:9000',
  authz: process.env.E2E_AUTHZ_URL ?? 'http://localhost:9100',
  /** Token do cliente administrativo (`make token-admin`), só para preparar os dados pelas APIs. */
  adminToken: process.env.E2E_ADMIN_TOKEN ?? '',
  /** Ociosidade da sessão do console configurada para o teste; sem ela, a jornada 5 é pulada. */
  sessionIdleSeconds: Number(process.env.E2E_SESSION_IDLE_SECONDS) || undefined,
}
