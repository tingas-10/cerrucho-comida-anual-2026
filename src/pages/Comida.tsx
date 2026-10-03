// Comida y lugar: decisiones oficiales, votaciones y propuestas con pulgares.
import { useSession } from '../data/DataContext'
import { useCollection, useEdition, useMembers } from '../data/hooks'
import { P } from '../data/paths'
import type { Poll } from '../data/types'
import { formatArs } from '../domain/expenses'
import { Card, Loading, PageHeader, Pill, Section } from '../ui/components'
import { PollCard } from '../ui/PollCard'
import { ProposalsBoard } from '../ui/Proposals'

export function Comida() {
  const { slug } = useSession()
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  const { rows: polls } = useCollection<Poll>(P.polls(slug))
  if (loading || !edition) return <Loading />
  const visible = polls.filter((p) => ['venue', 'food', 'custom'].includes(p.kind) && p.state !== 'DRAFT' && p.state !== 'VOID')
  return (
    <div>
      <PageHeader eyebrow="Esta edición" title="Comida y lugar" intro="Dos decisiones separadas: dónde y qué comemos. Proponé, votá con el dedito y Agus confirma la oficial." />

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex justify-between items-center">
            <p className="h3">Lugar</p>
            {edition.venue ? <Pill tone={edition.venue.reserved ? 'ok' : 'warn'}>{edition.venue.reserved ? 'Reservado' : 'Pendiente de reserva'}</Pill> : <Pill tone="muted">Sin definir</Pill>}
          </div>
          {edition.venue ? (
            <div className="mt-2 small">
              <p className="font-semibold text-base">{edition.venue.name}</p>
              {edition.venue.address ? <p className="muted">{edition.venue.address}</p> : null}
              {edition.venue.link ? (
                <a className="text-accent underline" href={edition.venue.link} target="_blank" rel="noopener noreferrer">
                  Ver link
                </a>
              ) : null}
              {typeof edition.venue.costPerPersonCents === 'number' ? <p className="mt-1">Costo estimado: {formatArs(edition.venue.costPerPersonCents)} por persona</p> : null}
              {edition.venue.capacity ? <p className="muted">Capacidad: {edition.venue.capacity}</p> : null}
              {edition.venue.responsibleId ? <p className="muted">Responsable: {members.aliasOf(edition.venue.responsibleId)}</p> : null}
              {edition.venue.notes ? <p className="mt-1">{edition.venue.notes}</p> : null}
            </div>
          ) : (
            <p className="small muted mt-2">Todavía no hay lugar confirmado.</p>
          )}
        </Card>
        <Card>
          <div className="flex justify-between items-center">
            <p className="h3">Menú</p>
            {edition.menu ? <Pill tone="ok">Confirmado</Pill> : <Pill tone="muted">Sin definir</Pill>}
          </div>
          {edition.menu ? (
            <div className="mt-2 small">
              <p className="font-semibold text-base">{edition.menu.name}</p>
              {edition.menu.modality ? <p className="muted">{edition.menu.modality}</p> : null}
              {typeof edition.menu.costPerPersonCents === 'number' ? <p className="mt-1">Costo estimado: {formatArs(edition.menu.costPerPersonCents)} por persona</p> : null}
              {edition.menu.includes ? <p className="mt-1">Incluye: {edition.menu.includes}</p> : null}
              {edition.menu.responsibleId ? <p className="muted">Responsable: {members.aliasOf(edition.menu.responsibleId)}</p> : null}
            </div>
          ) : (
            <p className="small muted mt-2">Todavía no hay menú confirmado.</p>
          )}
        </Card>
      </div>

      {visible.length ? (
        <Section title="Votaciones">
          <div className="grid gap-4">
            {visible.map((p) => (
              <PollCard key={p.id} poll={p} aliasOf={members.aliasOf} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Propuestas">
        <ProposalsBoard
          types={['food', 'venue']}
          typeOptions={[
            { value: 'food', label: 'Comida' },
            { value: 'venue', label: 'Lugar' },
          ]}
          intro="Lo que proponés lo ve toda la banda al instante y lo vota con 👍 o 👎. Agus confirma la opción oficial."
          placeholder="ej. Asado en lo de Topo"
        />
      </Section>
    </div>
  )
}
