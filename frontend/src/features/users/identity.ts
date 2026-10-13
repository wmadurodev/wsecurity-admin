import { useQueries } from '@tanstack/react-query'

import { getUser, type User, userKeys } from './api'

/**
 * Nome e e-mail de usuários pelo `sub` (Q-03): uma consulta por usuário ao IdP, em paralelo, guardada no cache durante
 * a sessão. Só para o administrador da plataforma; os demais não consultam o IdP (`enabled = false`).
 */
export function useUserIdentities(subjects: readonly string[], enabled: boolean): Map<string, User> {
  const results = useQueries({
    queries: subjects.map((subject) => ({
      queryKey: userKeys.detail(subject),
      queryFn: () => getUser(subject),
      enabled,
      staleTime: Infinity,
      retry: false,
    })),
  })
  const identities = new Map<string, User>()
  results.forEach((result, index) => {
    const subject = subjects[index]
    if (subject && result.data) {
      identities.set(subject, result.data.user)
    }
  })
  return identities
}
