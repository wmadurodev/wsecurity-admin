/** `datetime-local` da URL (`de`, `ate`) → ISO-8601 para a API (`from`, `to`). */
export const auditPeriod = (query: Record<string, string | number>) => {
  const toIso = (local: string | number | undefined) => (local ? new Date(String(local)).toISOString() : undefined)
  const { de, ate, ...rest } = query
  return { rest, from: toIso(de), to: toIso(ate) }
}
