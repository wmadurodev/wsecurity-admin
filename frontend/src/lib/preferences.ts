/**
 * Preferências da interface (RNF-SEG-08): o único uso de armazenamento local na SPA. Nunca guarde aqui dado de sessão,
 * token ou resposta de API.
 */
const PREFIX = 'wsadmin.pref.'

function storage(): Storage | undefined {
  try {
    // eslint-disable-next-line no-restricted-globals -- preferências da interface, permitidas por RNF-SEG-08
    return localStorage
  } catch {
    return undefined
  }
}

export function readPreference(name: 'sidebarCollapsed' | 'pageSize'): string | undefined {
  try {
    return storage()?.getItem(PREFIX + name) ?? undefined
  } catch {
    return undefined
  }
}

export function writePreference(name: 'sidebarCollapsed' | 'pageSize', value: string): void {
  try {
    storage()?.setItem(PREFIX + name, value)
  } catch {
    // Sem armazenamento (navegação privada): a preferência vale só nesta página.
  }
}
