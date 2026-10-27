// Amigo invisible: sorteo (lo usan Administración → Regalos y el Paso a paso del presidente).
import { REGALO_MIN_PARTICIPANTES } from '../content/config'
import { drawSecretSanta, validateDraw } from '../domain/gift'
import { logAudit, pushNews } from './actions'
import { DataError, type DataAdapter } from './adapter'
import { P } from './paths'
import type { GiftAssignment, GiftCampaign } from './types'

/** Sortea entre `roster` y publica el sorteo. Las asignaciones viejas de quien ya no participa se borran.
 *  No lee las asignaciones de nadie (esas las ve sólo Agus), así el que sortea tampoco se entera. */
export async function drawGift(db: DataAdapter, slug: string, by: string, gift: GiftCampaign, roster: string[], reason: string): Promise<void> {
  if (roster.length < REGALO_MIN_PARTICIPANTES) throw new DataError('GIFT_MIN_PARTICIPANTS', `Hacen falta al menos ${REGALO_MIN_PARTICIPANTES} participantes.`)
  const { pairs } = drawSecretSanta(roster)
  const invalid = validateDraw(roster, pairs)
  if (invalid) throw new DataError('INVARIANT_VIOLATION', invalid)
  const version = gift.drawVersion + 1
  const stale = (gift.roster ?? []).filter((id) => !roster.includes(id))
  await db.runTransaction(async (tx) => {
    const cur = await tx.get<GiftCampaign>(P.gift(slug))
    if (!cur) throw new DataError('NOT_FOUND')
    if (cur.drawVersion !== gift.drawVersion) throw new DataError('STATE_CONFLICT', 'Ya se hizo otro sorteo mientras tanto. Recargá.')
    for (const p of pairs) {
      tx.set(P.giftAssignment(slug, p.giverId), { receiverId: p.receiverId, version, viewedAt: null, readyAt: null, deliveredAt: null, revealedAt: null, giverRevealedId: null } satisfies GiftAssignment)
    }
    for (const id of stale) tx.delete(P.giftAssignment(slug, id))
    tx.update(P.gift(slug), { state: 'DRAW_PUBLISHED', drawVersion: version, roster, drawnAt: Date.now(), stats: { participants: roster.length, viewed: 0, ready: 0, delivered: 0 }, version: cur.version + 1, updatedAt: Date.now() })
  })
  await pushNews(db, slug, version > 1 ? 'Se rehízo el sorteo del amigo invisible: fijate de nuevo a quién le regalás.' : 'Ya está el sorteo del amigo invisible. Entrá a ver a quién le regalás.')
  await logAudit(db, slug, by, version > 1 ? 'gift.redraw' : 'gift.draw', `v${version} · ${roster.length} participantes`, reason)
}
