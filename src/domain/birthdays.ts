// Cumpleaños: agrupar por mes y calcular los próximos (en hora de Buenos Aires).

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export interface WithBirthday {
  id: string
  birthday?: { d: number; m: number } | null
}

export function isValidBirthday(d: number, m: number): boolean {
  if (!Number.isInteger(d) || !Number.isInteger(m) || m < 1 || m > 12 || d < 1) return false
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
  return d <= max
}

/** Hoy en Buenos Aires (UTC-3 fijo) como {y, m, d}. */
export function todayBA(now = Date.now()): { y: number; m: number; d: number } {
  const t = new Date(now - 3 * 3600000)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** Días hasta el próximo cumpleaños (0 = hoy). El 29/2 se festeja el 28/2 en años no bisiestos. */
export function daysUntil(b: { d: number; m: number }, now = Date.now()): number {
  const t = todayBA(now)
  const today = Date.UTC(t.y, t.m - 1, t.d)
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const dateIn = (y: number) => Date.UTC(y, b.m - 1, b.m === 2 && b.d === 29 && !isLeap(y) ? 28 : b.d)
  let next = dateIn(t.y)
  if (next < today) next = dateIn(t.y + 1)
  return Math.round((next - today) / 86400000)
}

export function byMonth<T extends WithBirthday>(people: T[]): Array<{ month: number; people: T[] }> {
  const out: Array<{ month: number; people: T[] }> = []
  for (let m = 1; m <= 12; m++) {
    const list = people.filter((p) => p.birthday?.m === m).sort((a, b) => a.birthday!.d - b.birthday!.d)
    if (list.length) out.push({ month: m, people: list })
  }
  return out
}

export function upcoming<T extends WithBirthday>(people: T[], count = 5, now = Date.now()): Array<T & { days: number }> {
  return people
    .filter((p) => p.birthday)
    .map((p) => ({ ...p, days: daysUntil(p.birthday!, now) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, count)
}

export function formatBirthday(b: { d: number; m: number }): string {
  return `${b.d} de ${MESES[b.m - 1].toLowerCase()}`
}
