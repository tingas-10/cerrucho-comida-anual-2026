// Decisiones definitivas de la comida anual: las toma el presidente (o el administrador).
// Siempre quedan registradas con quién y cuándo, separadas de lo "más votado".
import { fmtDayLong, fmtTime } from '../domain/format'
import { logAudit, pushNews } from './actions'
import type { DataAdapter } from './adapter'
import { P } from './paths'
import type { Edition, PollOption, Proposal } from './types'

/** Confirma la fecha definitiva. Si cambia una fecha ya confirmada, la asistencia hay que reconfirmarla. */
export async function confirmDate(db: DataAdapter, slug: string, edition: Edition, pollId: string, option: PollOption, actorId: string, reason = '') {
  if (!option.startsAt) return
  const now = Date.now()
  const changing = !!edition.date.startsAt && edition.date.startsAt !== option.startsAt
  const label = `${fmtDayLong(option.startsAt)} · ${fmtTime(option.startsAt)} h`
  await db.updateDoc(P.edition(slug), {
    date: { startsAt: option.startsAt, label: '', confirmedAt: now, confirmedBy: actorId, reason },
    planVersion: changing ? edition.planVersion + 1 : edition.planVersion,
    state: edition.state === 'DRAFT' || edition.state === 'ORGANIZING' ? 'CONFIRMED' : edition.state,
    'decisions.fecha': { status: 'CONFIRMED', label, confirmedBy: actorId, confirmedAt: now, reason, pollId },
    updatedAt: now,
  })
  await db.updateDoc(P.poll(slug, pollId), { decision: { optionId: option.id, reason, by: actorId, at: now }, updatedAt: now })
  await pushNews(db, slug, changing ? `Cambió la fecha: ${label}. Hay que reconfirmar asistencia.` : `Fecha confirmada: ${label}.`)
  await logAudit(db, slug, actorId, changing ? 'decision.fecha.cambio' : 'decision.fecha', option.id, reason)
}

/** Confirma un lugar o una comida tomando como base una propuesta votada. */
export async function confirmProposal(db: DataAdapter, slug: string, p: Proposal, actorId: string) {
  const now = Date.now()
  const key = p.type === 'venue' ? 'lugar' : p.type === 'food' ? 'menu' : 'salida'
  const decision = { status: 'CONFIRMED', label: p.label, confirmedBy: actorId, confirmedAt: now, proposalId: p.id }
  if (p.type === 'venue') {
    await db.updateDoc(P.edition(slug), { venue: { name: p.label, notes: p.detail ?? '', link: p.link ?? '', reserved: false }, [`decisions.${key}`]: decision, updatedAt: now })
  } else if (p.type === 'food') {
    await db.updateDoc(P.edition(slug), { menu: { name: p.label, modality: p.detail ?? '' }, [`decisions.${key}`]: decision, updatedAt: now })
  } else {
    await db.updateDoc(P.edition(slug), { afterparty: { name: p.label, zone: p.detail ?? '', link: p.link ?? '', reserved: false }, [`decisions.${key}`]: decision, updatedAt: now })
  }
  const what = p.type === 'venue' ? 'Lugar' : p.type === 'food' ? 'Comida' : 'Salida'
  await pushNews(db, slug, `${what} confirmado: ${p.label}.`)
  await logAudit(db, slug, actorId, `decision.${key}`, p.id)
}

/** Deja una decisión otra vez "a definir". */
export async function clearDecision(db: DataAdapter, slug: string, key: 'lugar' | 'menu' | 'salida', actorId: string) {
  const field = key === 'lugar' ? 'venue' : key === 'menu' ? 'menu' : 'afterparty'
  await db.updateDoc(P.edition(slug), { [field]: null, [`decisions.${key}`]: { status: 'UNDEFINED' }, updatedAt: Date.now() })
  await logAudit(db, slug, actorId, `decision.${key}.quitar`, key)
}
