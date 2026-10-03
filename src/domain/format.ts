// Fechas y textos en español rioplatense, siempre en hora de Buenos Aires.
import { GRUPO } from '../content/config'

const TZ = GRUPO.zonaHoraria

export function fmtDate(ms: number | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!ms) return ''
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, ...opts }).format(new Date(ms))
}

export function fmtDayLong(ms: number | null | undefined): string {
  return capitalize(fmtDate(ms, { weekday: 'long', day: 'numeric', month: 'long' }))
}

export function fmtDayShort(ms: number | null | undefined): string {
  return capitalize(fmtDate(ms, { weekday: 'short', day: 'numeric', month: 'short' }))
}

export function fmtTime(ms: number | null | undefined): string {
  return fmtDate(ms, { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function fmtDateTime(ms: number | null | undefined): string {
  if (!ms) return ''
  return `${fmtDayShort(ms)} · ${fmtTime(ms)} h`
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

/** Tiempo restante en texto: "cierra en 2 días", "cierra en 3 h", "cerró". */
export function timeLeft(closeAt: number | null | undefined, now = Date.now()): string {
  if (!closeAt) return 'sin cierre definido'
  const diff = closeAt - now
  if (diff <= 0) return 'cerró'
  const min = Math.round(diff / 60000)
  if (min < 60) return `cierra en ${min} min`
  const h = Math.round(diff / 3600000)
  if (h < 48) return `cierra en ${h} h`
  const d = Math.round(diff / 86400000)
  return `cierra en ${d} días`
}

export function countdown(target: number, now = Date.now()): { days: number; hours: number; minutes: number } | null {
  const diff = target - now
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  return { days, hours, minutes }
}

/** Convierte un input datetime-local (hora Buenos Aires) a ms UTC. */
export function localToMs(dateStr: string, timeStr: string): number | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = (timeStr || '21:00').split(':').map(Number)
  // Buenos Aires no tiene horario de verano: UTC-3 fijo.
  return Date.UTC(y, m - 1, d, hh + 3, mm)
}

export function msToLocalParts(ms: number | null | undefined): { date: string; time: string } {
  if (!ms) return { date: '', time: '' }
  const d = new Date(ms - 3 * 3600000)
  const date = d.toISOString().slice(0, 10)
  const time = d.toISOString().slice(11, 16)
  return { date, time }
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export function initials(alias: string): string {
  const parts = alias.trim().split(/\s+/)
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : alias.slice(0, 2)
  return s.toUpperCase()
}

const COLORS = ['#d9b45f', '#7bd88f', '#8ab4ff', '#ff9f80', '#c79bff', '#67d6d2', '#f2a9c4', '#ffd166']
export function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

export function hoursFromNow(h: number, now = Date.now()): number {
  return now + h * 3600000
}
