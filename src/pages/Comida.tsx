// Lugar y comida: lo confirmado arriba (o "A definir") y abajo las opciones para votar.
import { useEdition, useMembers } from '../data/hooks'
import { formatArs } from '../domain/expenses'
import { Card, Loading, PageHeader, Pill } from '../ui/components'
import { ProposalsBoard } from '../ui/Proposals'

export function Comida() {
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  if (loading || !edition) return <Loading />
  const lugar = edition.decisions?.lugar
  const menu = edition.decisions?.menu
  return (
    <div>
      <PageHeader eyebrow={edition.title} title="Lugar y comida" intro="Votá con el dedito las opciones que te gustan. Facu, como presidente, confirma las definitivas mirando la votación." />

      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <div className="flex justify-between items-center gap-2">
            <p className="eyebrow">Lugar</p>
            {edition.venue ? <Pill tone="ok">Confirmado</Pill> : <Pill tone="muted">A definir</Pill>}
          </div>
          {edition.venue ? (
            <div className="mt-1 small">
              <p className="font-bold text-lg">{edition.venue.name}</p>
              {edition.venue.address ? <p className="muted">{edition.venue.address}</p> : null}
              {typeof edition.venue.costPerPersonCents === 'number' ? <p>Costo estimado: {formatArs(edition.venue.costPerPersonCents)} por persona</p> : null}
              {lugar?.confirmedBy ? <p className="tiny muted mt-1">Confirmó {members.aliasOf(lugar.confirmedBy)}</p> : null}
            </div>
          ) : (
            <p className="small muted mt-1">Todavía no se confirmó.</p>
          )}
        </Card>
        <Card>
          <div className="flex justify-between items-center gap-2">
            <p className="eyebrow">Comida</p>
            {edition.menu ? <Pill tone="ok">Confirmada</Pill> : <Pill tone="muted">A definir</Pill>}
          </div>
          {edition.menu ? (
            <div className="mt-1 small">
              <p className="font-bold text-lg">{edition.menu.name}</p>
              {edition.menu.modality ? <p className="muted">{edition.menu.modality}</p> : null}
              {typeof edition.menu.costPerPersonCents === 'number' ? <p>Costo estimado: {formatArs(edition.menu.costPerPersonCents)} por persona</p> : null}
              {menu?.confirmedBy ? <p className="tiny muted mt-1">Confirmó {members.aliasOf(menu.confirmedBy)}</p> : null}
            </div>
          ) : (
            <p className="small muted mt-1">Todavía no se confirmó.</p>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <ProposalsBoard type="venue" title="Lugares" decisionKey="lugar" placeholder="ej. Quincho de Topo" />
        <ProposalsBoard type="food" title="Comidas" decisionKey="menu" placeholder="ej. Pizzas a la parrilla" />
      </div>
    </div>
  )
}
