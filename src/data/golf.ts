// Comisión de golf: propuestas que se aplican cuando las aprueban al menos 2 comisionados.
// Quien propone ya cuenta como una aprobación. Las reglas de Firestore verifican lo mismo del lado del servidor.
import { GOLF } from '../content/golf'
import type { DataAdapter } from './adapter'
import { DataError } from './adapter'
import { P } from './paths'
import type { GolfCard, GolfHole, GolfPlayerDoc, GolfPointsConfig, GolfProposal, GolfProposalType } from './types'

export type GolfPayload =
  | { type: 'points'; points: GolfPointsConfig }
  | { type: 'course'; courseId: string; name: string; holes: GolfHole[]; archived: boolean }
  | { type: 'round_fix'; roundId: string; cards: Record<string, GolfCard> }
  | { type: 'round_void'; roundId: string }
  | { type: 'hcp'; playerId: string; hcp: number }

export async function proposeGolf(db: DataAdapter, by: string, summary: string, payload: GolfPayload): Promise<string> {
  const id = db.newId()
  const now = Date.now()
  const { type, ...rest } = payload
  const p: GolfProposal = { id, type: type as GolfProposalType, summary, payload: rest, proposedBy: by, approvals: { [by]: now }, rejections: {}, status: 'OPEN', createdAt: now, updatedAt: now, appliedAt: null, appliedBy: null }
  await db.setDoc(P.golfProposal(id), p)
  return id
}

/** Aprobar o rechazar. Si con este voto llega a 2 aprobaciones, se aplica en el momento. */
export async function voteGolf(db: DataAdapter, p: GolfProposal, by: string, vote: 'approve' | 'reject'): Promise<'applied' | 'voted' | 'rejected'> {
  if (p.status !== 'OPEN') throw new DataError('CLOSED', 'Esta propuesta ya se cerró.')
  const now = Date.now()
  const approvals = { ...p.approvals }
  const rejections = { ...p.rejections }
  delete approvals[by]
  delete rejections[by]
  if (vote === 'approve') approvals[by] = now
  else rejections[by] = now
  await db.updateDoc(P.golfProposal(p.id), { approvals, rejections, updatedAt: now })
  const next = { ...p, approvals, rejections }
  if (Object.keys(approvals).length >= GOLF.aprobacionesNecesarias) {
    await applyGolf(db, next, by)
    return 'applied'
  }
  if (Object.keys(rejections).length >= GOLF.aprobacionesNecesarias) {
    await db.updateDoc(P.golfProposal(p.id), { status: 'REJECTED', updatedAt: Date.now() })
    return 'rejected'
  }
  return 'voted'
}

export async function withdrawGolf(db: DataAdapter, p: GolfProposal) {
  await db.updateDoc(P.golfProposal(p.id), { status: 'WITHDRAWN', updatedAt: Date.now() })
}

/** Aplica el cambio aprobado y marca la propuesta como aplicada, todo junto. */
export async function applyGolf(db: DataAdapter, p: GolfProposal, by: string) {
  const now = Date.now()
  const pl = p.payload as Record<string, unknown>
  await db.runTransaction(async (tx) => {
    const cur = await tx.get<GolfProposal>(P.golfProposal(p.id))
    if (!cur || cur.status !== 'OPEN') throw new DataError('CLOSED', 'Esta propuesta ya se aplicó o se cerró.')
    const prevPlayer = p.type === 'hcp' ? await tx.get<GolfPlayerDoc>(P.golfPlayer(pl.playerId as string)) : null
    if (p.type === 'points') tx.set(P.golfConfig, { points: pl.points, lastProposal: p.id, updatedAt: now })
    else if (p.type === 'course') tx.set(P.golfCourse(pl.courseId as string), { id: pl.courseId, name: pl.name, holes: pl.holes, archived: pl.archived, lastProposal: p.id, updatedAt: now })
    else if (p.type === 'round_fix') tx.update(P.golfRound(pl.roundId as string), { cards: pl.cards, lastProposal: p.id, updatedBy: by, updatedAt: now })
    else if (p.type === 'round_void') tx.update(P.golfRound(pl.roundId as string), { voided: true, lastProposal: p.id, updatedBy: by, updatedAt: now })
    else if (p.type === 'hcp') {
      const history = [...(prevPlayer?.history ?? []), { at: now, hcp: pl.hcp as number, by, proposalId: p.id }]
      tx.set(P.golfPlayer(pl.playerId as string), { hcp: pl.hcp, history, lastProposal: p.id, updatedAt: now })
    }
    tx.update(P.golfProposal(p.id), { status: 'APPLIED', appliedAt: now, appliedBy: by, updatedAt: now })
  })
}

/** El hándicap propio (o el de un invitado) lo carga cualquiera, sin comisión. */
export async function setOwnHcp(db: DataAdapter, playerId: string, hcp: number, by: string) {
  const now = Date.now()
  await db.runTransaction(async (tx) => {
    const prev = await tx.get<GolfPlayerDoc>(P.golfPlayer(playerId))
    const history = [...(prev?.history ?? []), { at: now, hcp, by }]
    tx.set(P.golfPlayer(playerId), { hcp, history, updatedAt: now })
  })
}
