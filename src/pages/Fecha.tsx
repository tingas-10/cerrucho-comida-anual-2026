// Fecha y asistencia: disponibilidad por fecha, propuesta de otra fecha y RSVP.
import { useEffect, useMemo, useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { DataError } from '../data/adapter'
import { electorateOf, useCollection, useDoc, useEdition, useMembers, useNow } from '../data/hooks'
import { P } from '../data/paths'
import type { Availability, Poll, PollResponse, Proposal, Rsvp } from '../data/types'
import { fmtDayLong, fmtDayShort, fmtTime, localToMs, timeLeft } from '../domain/format'
import { isPollOpen, participation, recommendDates, tallyAvailability } from '../domain/polls'
import { Avatar, Button, Card, Empty, Field, Input, Loading, Notice, PageHeader, Pill, Section, Textarea } from '../ui/components'
import { useToast } from '../ui/toast'
import { saveResponse } from '../ui/PollCard'

export function Fecha() {
  const { slug } = useSession()
  const { data: edition, loading } = useEdition()
  const { rows: polls } = useCollection<Poll>(P.polls(slug), [{ field: 'kind', op: '==', value: 'dates' }])
  const members = useMembers()
  if (loading || !edition) return <Loading />
  const visible = polls.filter((p) => p.state !== 'DRAFT' && p.state !== 'VOID').sort((a, b) => b.createdAt - a.createdAt)
  const open = visible.find((p) => p.state === 'OPEN')
  const closed = visible.filter((p) => p.state === 'CLOSED')
  return (
    <div>
      <PageHeader eyebrow="Esta edición" title="Fecha y asistencia" intro="Primero elegimos cuándo. Después, con fecha oficial, cada uno confirma si viene." />
      {edition.date.startsAt ? (
        <Card className="mb-4">
          <p className="eyebrow">Fecha oficial</p>
          <p className="h2 mt-1">
            {fmtDayLong(edition.date.startsAt)} · {fmtTime(edition.date.startsAt)} h
          </p>
          {edition.date.label ? <p className="small muted mt-1">{edition.date.label}</p> : null}
          {edition.venue?.name ? <p className="small mt-1">{edition.venue.name}</p> : null}
        </Card>
      ) : null}

      {edition.date.startsAt ? <RsvpCard edition={edition} /> : null}

      <Section title="Disponibilidad">
        {open ? <AvailabilityPoll poll={open} aliasOf={members.aliasOf} /> : null}
        {!open && !edition.date.startsAt ? (
          <Empty title="Todavía no hay fechas para votar" text="Agus va a publicar las fechas candidatas. Mientras tanto, podés proponer una." />
        ) : null}
        {closed.map((p) => (
          <div key={p.id} className="mt-3">
            <AvailabilityPoll poll={p} aliasOf={members.aliasOf} />
          </div>
        ))}
      </Section>

      <Section title="Proponer otra fecha">
        <ProposeDate />
      </Section>
    </div>
  )
}

function AvailabilityPoll({ poll, aliasOf }: { poll: Poll; aliasOf: (id: string) => string }) {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const now = useNow()
  const members = useMembers()
  const electorate = electorateOf(poll, members)
  const mine = useDoc<PollResponse>(memberId ? P.response(slug, poll.id, memberId) : null)
  const { rows: responses } = useCollection<PollResponse>(P.responses(slug, poll.id))
  const [answers, setAnswers] = useState<Record<string, Availability>>({})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (dirty) return
    setAnswers((mine.data?.payload as Record<string, Availability>) ?? {})
  }, [mine.data, dirty])

  const open = isPollOpen(poll, now)
  const isElector = !!memberId && electorate.includes(memberId)
  const rows = useMemo(() => tallyAvailability(poll, responses), [poll, responses])
  const rec = useMemo(() => recommendDates(rows), [rows])
  const part = participation(poll, responses.length, electorate.length)
  const complete = poll.options.every((o) => answers[o.id])

  function setAll(v: Availability) {
    setDirty(true)
    const next: Record<string, Availability> = {}
    for (const o of poll.options) next[o.id] = v
    setAnswers(next)
  }

  async function save() {
    if (!memberId) return
    setBusy(true)
    try {
      await saveResponse(db, slug, poll, memberId, answers, mine.data?.revision ?? 0)
      setDirty(false)
      toast.ok('Disponibilidad guardada')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="h3">{poll.title}</p>
          {poll.description ? <p className="small muted mt-1">{poll.description}</p> : null}
        </div>
        {poll.state === 'OPEN' ? <Pill tone={open ? 'accent' : 'muted'}>{open ? timeLeft(poll.closeAt, now) : 'Cerró'}</Pill> : <Pill tone="muted">Cerrada</Pill>}
      </div>
      <p className="tiny muted mb-3">Respondieron {responses.length} de {electorate.length} · quórum {poll.quorumPct}% {part.quorumMet ? 'alcanzado' : 'pendiente'}</p>

      {open && isElector ? (
        <div className="flex gap-2 mb-3 flex-wrap">
          <Button size="sm" variant="line" onClick={() => setAll('yes')}>
            Marcar todas como puedo
          </Button>
          <Button size="sm" variant="line" onClick={() => setAll('no')}>
            Marcar todas como no puedo
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3">
        {poll.options.map((o) => {
          const r = rows.find((x) => x.optionId === o.id)!
          const v = answers[o.id]
          const leader = rec.leaders.includes(o.id)
          return (
            <div key={o.id} className="rounded-xl border border-line p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <div className="flex items-center justify-between gap-2 sm:block sm:min-w-[210px]">
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">
                    {o.startsAt ? fmtDayLong(o.startsAt) : o.label}
                    {leader && rec.leaders.length === 1 && poll.state === 'OPEN' ? <Pill className="ml-2">Va ganando</Pill> : null}
                  </p>
                  <p className="tiny muted">
                    {o.startsAt ? `${fmtTime(o.startsAt)} h` : ''}
                    {o.detail ? `${o.startsAt ? ' · ' : ''}${o.detail}` : ''}
                  </p>
                </div>
                <div className="tiny muted text-right sm:text-left shrink-0">
                  <span className="text-ok font-semibold">{r.yes} puedo</span> · {r.maybe} capaz · {r.no} no
                </div>
              </div>
              {open && isElector ? (
                <div className="grid grid-cols-3 gap-2 mt-2 sm:mt-0 sm:w-[300px] shrink-0" role="radiogroup" aria-label={o.startsAt ? fmtDayLong(o.startsAt) : o.label}>
                  {(
                    [
                      ['yes', 'Puedo'],
                      ['maybe', 'Capaz'],
                      ['no', 'No puedo'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={v === val}
                      className="choice justify-center text-center px-2 text-sm min-h-[44px]"
                      onClick={() => {
                        setDirty(true)
                        setAnswers((a) => ({ ...a, [o.id]: val }))
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {open && isElector ? (
        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-4 z-10 mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2 shadow-lg">
          <span className="tiny muted">{complete ? 'Respondiste todas las fechas.' : `Respondiste ${poll.options.filter((o) => answers[o.id]).length} de ${poll.options.length}. Faltan para guardar.`}</span>
          <Button variant="gold" onClick={() => void save()} loading={busy} disabled={!complete || (!dirty && !!mine.data)}>
            {mine.data ? (dirty ? 'Guardar cambios' : 'Ya respondiste') : 'Guardar'}
          </Button>
        </div>
      ) : null}

      {poll.state === 'CLOSED' ? (
        <div className="mt-4">
          {poll.closure?.lowParticipation ? <Notice tone="warn">Cierre con baja participación: respondieron {poll.closure.count} de {electorate.length}.</Notice> : null}
          {!rec.viable ? <Notice tone="danger">Ninguna opción viable: ninguna fecha tuvo un Puedo.</Notice> : null}
          {rec.viable && rec.leaders.length > 1 ? <Notice tone="warn">Empate de disponibilidad entre {rec.leaders.length} fechas. Agus elige con motivo.</Notice> : null}
          {poll.decision ? (
            <Notice tone="ok">
              Fecha confirmada: {(() => {
                const o = poll.options.find((x) => x.id === poll.decision!.optionId)
                return o?.startsAt ? fmtDayLong(o.startsAt) : o?.label
              })()}{' '}
              · confirmó {aliasOf(poll.decision.by)}
              {poll.decision.reason ? ` · ${poll.decision.reason}` : ''}
            </Notice>
          ) : null}
        </div>
      ) : null}

      <details className="mt-4">
        <summary className="small font-semibold cursor-pointer">Ver quién puede cuándo</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left tiny muted">
                <th className="py-1 pr-2 sticky left-0 bg-card">Persona</th>
                {poll.options.map((o) => (
                  <th key={o.id} className="py-1 pr-2 whitespace-nowrap">
                    {o.startsAt ? fmtDayShort(o.startsAt) : o.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {electorate.map((id) => {
                const r = responses.find((x) => x.id === id)
                const payload = (r?.payload as Record<string, Availability>) ?? null
                return (
                  <tr key={id} className="border-t border-line">
                    <td className="py-1.5 pr-2 whitespace-nowrap sticky left-0 bg-card">
                      <span className="inline-flex items-center gap-2">
                        <Avatar id={id} alias={aliasOf(id)} size={22} /> {aliasOf(id)}
                      </span>
                    </td>
                    {poll.options.map((o) => (
                      <td key={o.id} className="py-1.5 pr-2">
                        {!payload ? <span className="tiny muted">sin responder</span> : payload[o.id] === 'yes' ? <span className="text-ok font-semibold">Puedo</span> : payload[o.id] === 'maybe' ? <span className="text-warn">Capaz</span> : <span className="muted">No puedo</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  )
}

function RsvpCard({ edition }: { edition: { planVersion: number; afterparty: unknown; date: { startsAt: number | null } } }) {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const mine = useDoc<Rsvp>(memberId ? P.rsvp(slug, memberId) : null)
  const [busy, setBusy] = useState(false)
  const [arrival, setArrival] = useState('')
  const [plan, setPlan] = useState<Rsvp['afterparty']>(null)
  useEffect(() => {
    setArrival(mine.data?.arrival ?? '')
    setPlan(mine.data?.afterparty ?? null)
  }, [mine.data])
  const needsReconfirm = !!mine.data && mine.data.planVersion !== edition.planVersion

  async function save(status: Rsvp['status']) {
    if (!memberId) return
    setBusy(true)
    try {
      await db.runTransaction(async (tx) => {
        const cur = await tx.get<Rsvp>(P.rsvp(slug, memberId))
        if ((cur?.revision ?? 0) !== (mine.data?.revision ?? 0)) throw new DataError('REVISION_CONFLICT')
        const r: Rsvp = { status, planVersion: edition.planVersion, arrival: arrival.trim(), afterparty: plan, updatedAt: Date.now(), revision: (cur?.revision ?? 0) + 1 }
        tx.set(P.rsvp(slug, memberId), r)
      })
      toast.ok(status === 'YES' ? '¡Confirmado! Te esperamos.' : 'Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const current = needsReconfirm ? null : mine.data?.status
  return (
    <Card className="mb-4">
      <p className="h3">¿Venís?</p>
      {needsReconfirm ? <Notice tone="warn">Cambió el plan. Volvé a confirmar.</Notice> : null}
      <div className="grid grid-cols-3 gap-2 mt-3" role="radiogroup" aria-label="Asistencia">
        {(
          [
            ['YES', 'Voy'],
            ['MAYBE', 'Todavía no sé'],
            ['NO', 'No voy'],
          ] as const
        ).map(([val, label]) => (
          <button key={val} type="button" role="radio" aria-checked={current === val} className="choice justify-center" disabled={busy} onClick={() => void save(val)}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <Field label="Llegada estimada (opcional)" id="arrival">
          <Input id="arrival" value={arrival} onChange={(e) => setArrival(e.target.value)} placeholder="ej. 21:30" />
        </Field>
        <Field label="Después de comer" id="plan">
          <select id="plan" className="input" value={plan ?? ''} onChange={(e) => setPlan((e.target.value || null) as Rsvp['afterparty'])}>
            <option value="">Sin definir</option>
            <option value="STAY_AWARDS">Me quedo hasta los premios</option>
            <option value="LEAVE_AFTER_DINNER">Me vuelvo después de comer</option>
            <option value="JOIN">Me sumo a salir</option>
          </select>
        </Field>
      </div>
      {mine.data && !needsReconfirm ? (
        <Button size="sm" variant="line" onClick={() => void save(mine.data!.status)} loading={busy}>
          Guardar detalles
        </Button>
      ) : null}
      <p className="tiny muted mt-3">Confirmar la comida anual no te anota al amigo invisible: eso se hace aparte.</p>
    </Card>
  )
}

function ProposeDate() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const { rows } = useCollection<Proposal>(P.proposals(slug), [{ field: 'type', op: '==', value: 'date' }])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('21:00')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const mine = rows.filter((p) => p.authorId === memberId && p.state === 'PENDING')

  async function submit() {
    const ms = localToMs(date, time)
    if (!ms || !memberId) {
      toast.error('Elegí una fecha.')
      return
    }
    setBusy(true)
    try {
      const id = db.newId()
      const p: Proposal = { id, type: 'date', authorId: memberId, label: fmtDayLong(ms), detail: detail.trim(), startsAt: ms, state: 'PENDING', createdAt: Date.now(), updatedAt: Date.now() }
      await db.setDoc(P.proposal(slug, id), p)
      setDate('')
      setDetail('')
      toast.ok('Propuesta enviada. Agus la revisa.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <p className="small muted mb-3">Si ninguna fecha te sirve, proponé otra. Queda pendiente hasta que Agus la apruebe.</p>
      <div className="grid sm:grid-cols-[1fr_120px] gap-3">
        <Field label="Fecha" id="prop-date">
          <Input id="prop-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hora" id="prop-time">
          <Input id="prop-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Comentario (opcional)" id="prop-detail">
        <Textarea id="prop-detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={200} />
      </Field>
      <Button onClick={() => void submit()} loading={busy}>
        Proponer fecha
      </Button>
      {mine.length ? (
        <div className="mt-4">
          {mine.map((p) => (
            <div key={p.id} className="row">
              <span className="small">
                {p.label} {p.detail ? `· ${p.detail}` : ''}
              </span>
              <span className="flex items-center gap-2">
                <Pill tone="warn">Pendiente</Pill>
                <Button size="sm" variant="line" onClick={() => void db.updateDoc(P.proposal(slug, p.id), { state: 'WITHDRAWN', updatedAt: Date.now() })}>
                  Retirar
                </Button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  )
}
