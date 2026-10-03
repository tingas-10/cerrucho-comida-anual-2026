import { Link } from 'react-router-dom'
import { useSession } from '../data/DataContext'
import { useCollection, useEdition, useMembers } from '../data/hooks'
import { P } from '../data/paths'
import type { Rsvp } from '../data/types'
import { Avatar, Card, Empty, Loading, PageHeader, Pill, Stat } from '../ui/components'

export function Miembros() {
  const { slug, isAdmin } = useSession()
  const members = useMembers()
  const { data: edition } = useEdition()
  const { rows: rsvps } = useCollection<Rsvp>(P.rsvps(slug))
  if (members.loading) return <Loading />
  const planVersion = edition?.planVersion ?? 1
  const rsvpOf = (id: string) => rsvps.find((r) => r.id === id)
  const active = members.active.filter((m) => m.participating)
  const yes = active.filter((m) => rsvpOf(m.id)?.status === 'YES' && rsvpOf(m.id)?.planVersion === planVersion).length
  const no = active.filter((m) => rsvpOf(m.id)?.status === 'NO').length
  const pending = active.length - yes - no
  const drafts = members.list.filter((m) => m.status === 'draft')
  return (
    <div>
      <PageHeader
        eyebrow="La banda"
        title="Miembros"
        intro="Quiénes somos este año. Los mails no se muestran a nadie."
        actions={
          isAdmin ? (
            <Link to="/admin/miembros" className="btn btn-gold">
              Cargar mails y nombres
            </Link>
          ) : null
        }
      />
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Participan" value={active.length} />
        <Stat label="Confirmaron" value={yes} hint={edition?.date.startsAt ? 'que vienen' : 'sin fecha aún'} />
        <Stat label="Sin responder" value={pending} />
      </div>
      {active.length === 0 ? (
        <Empty title="Todavía no hay miembros activos" text="Agus tiene que cargar los mails desde Administración." />
      ) : (
        <Card>
          {active.map((m) => {
            const r = rsvpOf(m.id)
            const status = !edition?.date.startsAt ? null : r?.planVersion !== planVersion && r ? 'reconfirmar' : r?.status
            return (
              <div key={m.id} className="row">
                <div className="flex items-center gap-3">
                  <Avatar id={m.id} alias={m.alias} color={m.avatarColor} />
                  <div>
                    <p className="font-semibold">{m.alias}</p>
                    {m.vao ? <p className="tiny muted">Fue al VAO</p> : null}
                  </div>
                </div>
                <div>
                  {status === 'YES' ? <Pill tone="ok">Viene</Pill> : null}
                  {status === 'NO' ? <Pill tone="muted">No viene</Pill> : null}
                  {status === 'MAYBE' ? <Pill tone="warn">Todavía no sabe</Pill> : null}
                  {status === 'reconfirmar' ? <Pill tone="warn">Necesita reconfirmar</Pill> : null}
                  {m.role === 'owner' ? <Pill className="ml-2">Organiza</Pill> : null}
                </div>
              </div>
            )
          })}
        </Card>
      )}
      {drafts.length > 0 ? (
        <p className="tiny muted mt-4">
          Hay {drafts.length} alias del grupo que todavía no tienen mail cargado: {drafts.map((d) => d.alias).join(', ')}.
        </p>
      ) : null}
    </div>
  )
}
