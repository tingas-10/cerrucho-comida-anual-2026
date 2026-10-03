// Agenda de la noche, salida posterior y transporte.
import { useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { useCollection, useDoc, useEdition, useMembers } from '../data/hooks'
import { P } from '../data/paths'
import type { Poll, Rsvp, TransportEntry } from '../data/types'
import { formatArs } from '../domain/expenses'
import { fmtDayLong, fmtTime } from '../domain/format'
import { Button, Card, Field, Input, Loading, LoginPrompt, Notice, PageHeader, Pill, Section } from '../ui/components'
import { PollCard } from '../ui/PollCard'
import { ProposalsBoard } from '../ui/Proposals'
import { useToast } from '../ui/toast'

export function Agenda() {
  const { slug, memberId, db, isMember } = useSession()
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  const { rows: polls } = useCollection<Poll>(P.polls(slug), [{ field: 'kind', op: '==', value: 'afterparty' }])
  const myRsvp = useDoc<Rsvp>(isMember && memberId ? P.rsvp(slug, memberId) : null)
  if (loading || !edition) return <Loading />
  const hasDate = !!edition.date.startsAt
  const visiblePolls = polls.filter((p) => p.state !== 'DRAFT' && p.state !== 'VOID')

  function icsDownload() {
    if (!edition?.date.startsAt) return
    const start = new Date(edition.date.startsAt)
    const end = new Date(edition.date.startsAt + 5 * 3600000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//La Banda del cerrucho//ES',
      'BEGIN:VEVENT',
      `UID:cerrucho-${edition.slug}@labanda`,
      `SEQUENCE:${edition.planVersion}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${edition.title}`,
      edition.venue?.address ? `LOCATION:${edition.venue.name} - ${edition.venue.address}` : edition.venue?.name ? `LOCATION:${edition.venue.name}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean)
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comida-anual-${edition.slug}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader eyebrow={edition.title} title="Agenda y salida" intro={hasDate ? 'La noche, paso a paso.' : 'Secuencia borrador. Los horarios se publican cuando haya fecha oficial.'} actions={hasDate ? <Button variant="line" onClick={icsDownload}>Agregar al calendario</Button> : null} />

      <Card>
        {hasDate ? (
          <p className="h3 mb-3">
            {fmtDayLong(edition.date.startsAt)} · {fmtTime(edition.date.startsAt)} h{edition.venue?.name ? ` · ${edition.venue.name}` : ''}
          </p>
        ) : null}
        <ol className="relative border-l border-line ml-3">
          {edition.agenda.map((item) => (
            <li key={item.key} className="ml-5 pb-5 last:pb-0">
              <span className="absolute -left-[7px] mt-1.5 w-3.5 h-3.5 rounded-full bg-gold border-2 border-card" aria-hidden />
              <p className="font-semibold">
                {item.label}
                {edition.agendaPublished && item.startsAt ? <span className="ml-2 text-accent">{fmtTime(item.startsAt)} h</span> : <span className="ml-2 tiny muted">sin hora oficial</span>}
              </p>
              {item.responsibleId ? <p className="tiny muted">Responsable: {members.aliasOf(item.responsibleId)}</p> : null}
              {item.notes ? <p className="small muted">{item.notes}</p> : null}
            </li>
          ))}
        </ol>
        {edition.venue?.address && hasDate ? <p className="small mt-4">Dirección: {edition.venue.address}</p> : null}
      </Card>

      <Section title="La salida">
        {edition.afterparty ? (
          <Card className="mb-3">
            <div className="flex justify-between items-center">
              <p className="h3">{edition.afterparty.name}</p>
              <Pill tone={edition.afterparty.reserved ? 'ok' : 'warn'}>{edition.afterparty.reserved ? 'Reservado' : 'Sin reserva'}</Pill>
            </div>
            <p className="small muted">
              {edition.afterparty.zone ?? ''}
              {typeof edition.afterparty.entryCostCents === 'number' ? ` · entrada ${formatArs(edition.afterparty.entryCostCents)}` : ''}
              {edition.afterparty.dressCode ? ` · dress code: ${edition.afterparty.dressCode}` : ''}
            </p>
            {edition.afterparty.link ? (
              <a className="text-accent underline small" href={edition.afterparty.link} target="_blank" rel="noopener noreferrer">
                Ver link
              </a>
            ) : null}
          </Card>
        ) : null}
        <Card className={isMember ? 'mb-3' : 'hidden'}>
          <p className="small muted">Tu plan después de comer: {myRsvp.data?.afterparty === 'JOIN' ? 'me sumo a salir' : myRsvp.data?.afterparty === 'LEAVE_AFTER_DINNER' ? 'me vuelvo después de comer' : myRsvp.data?.afterparty === 'STAY_AWARDS' ? 'me quedo hasta los premios' : 'sin definir'}. Se cambia desde Fecha y asistencia.</p>
        </Card>
        {visiblePolls.map((p) => (
          <div key={p.id} className="mb-3">
            <PollCard poll={p} aliasOf={members.aliasOf} />
            {p.audience === 'AFTERPARTY' ? <p className="tiny muted mt-1">Votan sólo quienes marcaron "Me sumo a salir".</p> : null}
          </div>
        ))}
        <ProposalsBoard type="afterparty" title="A dónde seguimos" decisionKey="salida" placeholder="ej. Bar de Topo" />
      </Section>

      <Section title="Transporte">
        {isMember ? <Transport memberId={memberId} db={db} slug={slug} aliasOf={members.aliasOf} /> : <LoginPrompt text="Entrá para coordinar quién lleva a quién." />}
      </Section>
    </div>
  )
}

function Transport({ memberId, db, slug, aliasOf }: { memberId: string | null; db: ReturnType<typeof useSession>['db']; slug: string; aliasOf: (id: string) => string }) {
  const toast = useToast()
  const { isAdmin } = useSession()
  const { rows } = useCollection<TransportEntry>(P.transport(slug))
  const [kind, setKind] = useState<TransportEntry['kind']>('NEED')
  const [leg, setLeg] = useState<TransportEntry['leg']>('DINNER')
  const [seats, setSeats] = useState(3)
  const [origin, setOrigin] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const mine = rows.filter((r) => r.memberId === memberId)

  async function submit() {
    if (!memberId) return
    setBusy(true)
    try {
      const id = db.newId()
      await db.setDoc<TransportEntry>(P.transportEntry(slug, id), { id, memberId, kind, leg, seats: kind === 'OFFER' ? Math.max(1, seats) : 1, originHint: origin.trim(), time: time.trim(), passengers: [], createdAt: Date.now() })
      setOrigin('')
      toast.ok('Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const offers = rows.filter((r) => r.kind === 'OFFER')
  const needs = rows.filter((r) => r.kind === 'NEED')
  const taxis = rows.filter((r) => r.kind === 'TAXI')
  const involved = (r: TransportEntry) => isAdmin || r.memberId === memberId || r.passengers.includes(memberId ?? '')

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <p className="h3 mb-2">Cómo vas</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qué necesitás" id="tr-kind">
            <select id="tr-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as TransportEntry['kind'])}>
              <option value="NEED">Necesito traslado</option>
              <option value="OFFER">Ofrezco lugar</option>
              <option value="TAXI">Comparto taxi / remís</option>
            </select>
          </Field>
          <Field label="Tramo" id="tr-leg">
            <select id="tr-leg" className="input" value={leg} onChange={(e) => setLeg(e.target.value as TransportEntry['leg'])}>
              <option value="DINNER">A la comida</option>
              <option value="AFTERPARTY">A la salida</option>
            </select>
          </Field>
        </div>
        {kind === 'OFFER' ? (
          <Field label="Asientos" id="tr-seats">
            <Input id="tr-seats" type="number" min={1} max={8} value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Zona de referencia" id="tr-origin" hint="Aproximada, no la dirección exacta.">
            <Input id="tr-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="ej. Palermo" />
          </Field>
          <Field label="Hora" id="tr-time">
            <Input id="tr-time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="ej. 21:00" />
          </Field>
        </div>
        <Button onClick={() => void submit()} loading={busy}>
          Guardar
        </Button>
        {mine.length ? (
          <div className="mt-3">
            {mine.map((r) => (
              <div key={r.id} className="row">
                <span className="small">
                  {r.kind === 'OFFER' ? `Ofrezco ${r.seats} lugares` : r.kind === 'NEED' ? 'Necesito traslado' : 'Taxi compartido'} · {r.leg === 'DINNER' ? 'comida' : 'salida'} {r.originHint ? `· ${r.originHint}` : ''}
                </span>
                <Button size="sm" variant="line" onClick={() => void db.deleteDoc(P.transportEntry(slug, r.id))}>
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
      <Card>
        <p className="h3 mb-2">Quién ofrece y quién necesita</p>
        {offers.length === 0 && needs.length === 0 && taxis.length === 0 ? <p className="small muted">Nadie cargó nada todavía.</p> : null}
        {offers.map((r) => (
          <div key={r.id} className="row items-start">
            <span className="small">
              <b>{aliasOf(r.memberId)}</b> ofrece {r.seats} lugares · {r.leg === 'DINNER' ? 'comida' : 'salida'} {r.originHint ? `· desde ${r.originHint}` : ''} {r.time ? `· ${r.time}` : ''}
              {involved(r) && r.passengers.length ? <span className="block tiny muted">Van: {r.passengers.map(aliasOf).join(', ')}</span> : null}
            </span>
            <Pill tone={r.passengers.length >= r.seats ? 'muted' : 'ok'}>{Math.max(0, r.seats - r.passengers.length)} libres</Pill>
          </div>
        ))}
        {needs.map((r) => (
          <div key={r.id} className="row">
            <span className="small">
              <b>{aliasOf(r.memberId)}</b> necesita traslado · {r.leg === 'DINNER' ? 'comida' : 'salida'} {r.originHint ? `· ${r.originHint}` : ''}
            </span>
            {r.passengers.length ? <Pill tone="ok">Asignado</Pill> : <Pill tone="warn">Sin asignar</Pill>}
          </div>
        ))}
        {taxis.map((r) => (
          <div key={r.id} className="row">
            <span className="small">
              <b>{aliasOf(r.memberId)}</b> comparte taxi · {r.leg === 'DINNER' ? 'comida' : 'salida'} {r.originHint ? `· ${r.originHint}` : ''}
            </span>
          </div>
        ))}
        <p className="tiny muted mt-3">Agus asigna los lugares. Los compañeros de viaje se muestran sólo a los involucrados.</p>
        {!memberId ? <Notice>Entrá para cargar tu traslado.</Notice> : null}
      </Card>
    </div>
  )
}
