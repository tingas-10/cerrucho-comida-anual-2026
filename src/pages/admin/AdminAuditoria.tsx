// Auditoría: registro de acciones sensibles (sólo lectura).
import { useSession } from '../../data/DataContext'
import { useCollection, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import type { AuditEntry } from '../../data/types'
import { fmtDateTime } from '../../domain/format'
import { Card, Loading } from '../../ui/components'

export function AdminAuditoria() {
  const { slug } = useSession()
  const members = useMembers()
  const { rows, loading } = useCollection<AuditEntry>(P.audit(slug))
  if (loading) return <Loading />
  const list = [...rows].sort((a, b) => b.at - a.at)
  return (
    <Card>
      <p className="h3 mb-2">Registro</p>
      <p className="tiny muted mb-3">Actor, acción, entidad y motivo. No contiene votos ni destinatarios.</p>
      {list.length === 0 ? <p className="small muted">Sin registros todavía.</p> : null}
      {list.map((e) => (
        <div key={e.id} className="py-2 border-t border-line small">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">{members.aliasOf(e.actorId)}</span>
            <span className="tiny muted whitespace-nowrap">{fmtDateTime(e.at)}</span>
          </div>
          <p className="break-words">
            <span className="font-mono text-xs">{e.action}</span> <span className="tiny muted">· {e.entity}</span>
          </p>
          {e.reason ? <p className="tiny muted break-words">{e.reason}</p> : null}
        </div>
      ))}
    </Card>
  )
}
