// Reglas puras de encuestas logísticas: disponibilidad, aprobación, voto único, quórum.
import type { Availability, Poll, PollResponse } from '../data/types'

export interface AvailabilityRow {
  optionId: string
  yes: number
  maybe: number
  no: number
}

export function tallyAvailability(poll: Poll, responses: Array<PollResponse & { id: string }>): AvailabilityRow[] {
  return poll.options.map((o) => {
    const row: AvailabilityRow = { optionId: o.id, yes: 0, maybe: 0, no: 0 }
    for (const r of responses) {
      const payload = r.payload as Record<string, Availability>
      const v = payload?.[o.id]
      if (v === 'yes') row.yes++
      else if (v === 'maybe') row.maybe++
      else if (v === 'no') row.no++
    }
    return row
  })
}

/** Ordena por Puedo y después Capaz. Devuelve los ids líderes (más de uno = empate). */
export function recommendDates(rows: AvailabilityRow[]): { leaders: string[]; viable: boolean } {
  const viable = rows.some((r) => r.yes > 0)
  if (!viable) return { leaders: [], viable: false }
  const sorted = [...rows].sort((a, b) => b.yes - a.yes || b.maybe - a.maybe)
  const top = sorted[0]
  const leaders = sorted.filter((r) => r.yes === top.yes && r.maybe === top.maybe).map((r) => r.optionId)
  return { leaders, viable: true }
}

export function tallyApproval(poll: Poll, responses: Array<PollResponse & { id: string }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const o of poll.options) counts[o.id] = 0
  for (const r of responses) {
    const list = Array.isArray(r.payload) ? (r.payload as string[]) : []
    for (const id of new Set(list)) if (id in counts) counts[id]++
  }
  return counts
}

export function tallySingle(poll: Poll, responses: Array<PollResponse & { id: string }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const o of poll.options) counts[o.id] = 0
  for (const r of responses) {
    const id = typeof r.payload === 'string' ? r.payload : null
    if (id && id in counts) counts[id]++
  }
  return counts
}

export function leaders(counts: Record<string, number>): string[] {
  const max = Math.max(0, ...Object.values(counts))
  if (max === 0) return []
  return Object.entries(counts)
    .filter(([, n]) => n === max)
    .map(([k]) => k)
}

export function participation(poll: Poll, responded: number, electorateSize = poll.electorate.length): { pct: number; quorumMet: boolean } {
  const n = electorateSize
  const pct = n === 0 ? 0 : Math.round((responded / n) * 100)
  return { pct, quorumMet: n > 0 && pct >= poll.quorumPct }
}

export function isPollOpen(poll: Poll, now: number): boolean {
  return poll.state === 'OPEN' && (poll.closeAt == null || now < poll.closeAt)
}

export function validateResponse(poll: Poll, payload: PollResponse['payload']): string | null {
  const ids = new Set(poll.options.map((o) => o.id))
  if (poll.method === 'AVAILABILITY') {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Respuesta inválida'
    const p = payload as Record<string, Availability>
    for (const o of poll.options) {
      if (!['yes', 'maybe', 'no'].includes(p[o.id])) return 'Respondé todas las fechas'
    }
    return null
  }
  if (poll.method === 'APPROVAL') {
    if (!Array.isArray(payload)) return 'Respuesta inválida'
    if (payload.some((id) => !ids.has(id))) return 'Opción inválida'
    if (new Set(payload).size !== payload.length) return 'Opciones repetidas'
    if (payload.length === 0) return 'Marcá al menos una opción'
    return null
  }
  if (typeof payload !== 'string' || !ids.has(payload)) return 'Elegí una opción'
  return null
}
