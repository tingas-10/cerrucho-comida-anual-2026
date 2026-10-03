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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="tiny muted text-left">
              <th className="py-1 pr-2">Cuándo</th>
              <th className="py-1 pr-2">Quién</th>
              <th className="py-1 pr-2">Acción</th>
              <th className="py-1 pr-2">Entidad</th>
              <th className="py-1 pr-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="py-1.5 pr-2 whitespace-nowrap tiny">{fmtDateTime(e.at)}</td>
                <td className="py-1.5 pr-2">{members.aliasOf(e.actorId)}</td>
                <td className="py-1.5 pr-2 font-mono text-xs">{e.action}</td>
                <td className="py-1.5 pr-2 text-xs">{e.entity}</td>
                <td className="py-1.5 pr-2 tiny muted">{e.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
