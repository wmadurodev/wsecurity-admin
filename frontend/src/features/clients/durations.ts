/** Durações ISO-8601 do IdP (ex.: `PT5M`, `P30D`, `PT720H`) ↔ minutos e dias do formulário. */
const ISO = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/

export function toSeconds(duration: string | null | undefined): number | undefined {
  if (!duration) {
    return undefined
  }
  const match = ISO.exec(duration)
  if (!match) {
    return undefined
  }
  const [, days, hours, minutes, seconds] = match
  return Number(days ?? 0) * 86_400 + Number(hours ?? 0) * 3_600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0)
}

export function toMinutes(duration: string | null | undefined): number | undefined {
  const seconds = toSeconds(duration)
  return seconds === undefined ? undefined : Math.round((seconds / 60) * 100) / 100
}

export function toDays(duration: string | null | undefined): number | undefined {
  const seconds = toSeconds(duration)
  return seconds === undefined ? undefined : Math.round((seconds / 86_400) * 100) / 100
}

export const minutes = (value: number) => `PT${value}M`
export const days = (value: number) => `P${value}D`

/** Texto curto para leitura: "5 min", "30 dias". */
export function describe(duration: string | null | undefined): string {
  const seconds = toSeconds(duration)
  if (seconds === undefined) {
    return '—'
  }
  if (seconds % 86_400 === 0) {
    return `${seconds / 86_400} ${seconds === 86_400 ? 'dia' : 'dias'}`
  }
  if (seconds % 3_600 === 0) {
    return `${seconds / 3_600} h`
  }
  return `${Math.round(seconds / 60)} min`
}
