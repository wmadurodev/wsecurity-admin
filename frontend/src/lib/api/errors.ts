/** Problem Details (RFC 9457) das APIs e do BFF. */
export interface Problem {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  traceId?: string
  /** `400 validation-failed`: erros por campo. */
  errors?: { field: string; message: string }[]
  /** `422`: regras de negócio violadas (ex.: `scope-unknown:x`). */
  violations?: string[]
}

/** Erro de uma chamada ao BFF, com o Problem Details convertido (RF-NAV-05). */
export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem
  readonly fieldErrors: Record<string, string>
  readonly violations: string[]
  readonly traceId: string | undefined

  constructor(status: number, problem: Problem) {
    super(problem.title ?? `Erro HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
    this.fieldErrors = Object.fromEntries((problem.errors ?? []).map((error) => [error.field, error.message]))
    this.violations = problem.violations ?? []
    this.traceId = problem.traceId
  }

  /** Conflito ou versão desatualizada (`If-Match`): a tela oferece recarregar (RF-NAV-07). */
  get isConflict(): boolean {
    return this.status === 409 || this.status === 412
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** Converte a resposta de erro, aceitando corpos que não são Problem Details. */
export async function toApiError(response: Response): Promise<ApiError> {
  let problem: Problem = {}
  const type = response.headers.get('Content-Type') ?? ''
  if (type.includes('json')) {
    try {
      problem = (await response.json()) as Problem
    } catch {
      problem = {}
    }
  }
  return new ApiError(response.status, { status: response.status, ...problem })
}
