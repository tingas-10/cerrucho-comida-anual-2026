// Premios: abrir la votación (lo usan Administración → Premios y el Paso a paso del presidente).
import { fmtDateTime } from '../domain/format'
import { logAudit, pushNews, setDecision } from './actions'
import { DataError, type DataAdapter } from './adapter'
import { P } from './paths'
import type { Award } from './types'

/** Abre (o programa) la primera vuelta de las categorías dadas. Devuelve cuántas abrió. */
export async function openAwardsVoting(
  db: DataAdapter,
  slug: string,
  by: string,
  awards: Award[],
  electorate: string[],
  candidatesFor: (a: Award) => string[],
  openAtMs: number | null,
  closeAtMs: number | null,
): Promise<number> {
  if (!openAtMs || !closeAtMs) throw new DataError('VALIDATION_ERROR', 'Completá cuándo abre y cuándo cierra.')
  if (closeAtMs <= openAtMs) throw new DataError('VALIDATION_ERROR', 'El cierre tiene que ser después de la apertura.')
  if (closeAtMs <= Date.now()) throw new DataError('VALIDATION_ERROR', 'El cierre tiene que ser en el futuro.')
  if (electorate.length === 0) throw new DataError('VALIDATION_ERROR', 'No hay miembros activos para votar.')
  let opened = 0
  for (const a of awards) {
    const candidates = candidatesFor(a)
    if (candidates.length === 0) continue
    await db.updateDoc(P.award(slug, a.code), { state: 'ROUND1_OPEN', candidates, electorate, round1: { openAt: openAtMs, closeAt: closeAtMs }, updatedAt: Date.now(), version: a.version + 1 })
    opened++
  }
  await setDecision(db, slug, 'premios', { status: 'VOTING' })
  await pushNews(db, slug, `Votación de premios: abre ${fmtDateTime(openAtMs)} y cierra ${fmtDateTime(closeAtMs)}.`)
  await logAudit(db, slug, by, 'awards.open', `${opened} categorías`)
  return opened
}
