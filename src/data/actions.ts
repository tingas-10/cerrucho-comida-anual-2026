// Mutaciones compartidas (auditoría, novedades, decisiones).
import type { DataAdapter } from './adapter'
import { P } from './paths'
import type { AuditEntry, DecisionInfo, Edition } from './types'

export async function logAudit(db: DataAdapter, slug: string, actorId: string, action: string, entity: string, reason?: string) {
  const id = db.newId()
  const entry: AuditEntry = { id, actorId, action, entity, reason: reason ?? '', at: Date.now() }
  await db.setDoc(P.auditEntry(slug, id), entry)
}

/** Agrega una novedad visible al grupo (máximo 20, las más nuevas primero). */
export async function pushNews(db: DataAdapter, slug: string, text: string) {
  await db.runTransaction(async (tx) => {
    const e = await tx.get<Edition>(P.edition(slug))
    if (!e) return
    const news = [{ at: Date.now(), text }, ...(e.news ?? [])].slice(0, 20)
    tx.update(P.edition(slug), { news, updatedAt: Date.now() })
  })
}

export async function setDecision(db: DataAdapter, slug: string, key: string, info: DecisionInfo) {
  await db.updateDoc(P.edition(slug), { [`decisions.${key}`]: info, updatedAt: Date.now() })
}

export function errorText(e: unknown): string {
  const err = e as { code?: string; message?: string }
  if (err?.code === 'ACCESS_DENIED') return 'No tenés permiso para hacer eso (o la votación cerró).'
  if (err?.code === 'OFFLINE') return 'Sin conexión. Probá de nuevo.'
  if (err?.code === 'REVISION_CONFLICT') return 'Alguien cambió esto mientras editabas. Recargá y revisá.'
  return err?.message ?? 'Error inesperado'
}
