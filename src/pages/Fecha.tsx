// Fecha y asistencia: calendario compacto de disponibilidad, fecha confirmada por el presidente y asistencia.
import { Check, CircleHelp, Star, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText, logAudit } from '../data/actions'
import { DataError } from '../data/adapter'
import { confirmDate } from '../data/decisions'
import { electorateOf, useCollection, useDoc, useEdition, useMembers, useNow } from '../data/hooks'
import { P } from '../data/paths'
import type { Availability, Edition, Poll, PollOption, PollResponse, Rsvp } from '../data/types'
import { fmtDayLong, fmtTime, localToMs, timeLeft } from '../domain/format'
import { bestDates, fillPending, isPollOpen, summarizeDates, type DateSummary } from '../domain/polls'
import { MESES } from '../domain/birthdays'
import { Button, Card, ConfirmDialog, Empty, Field, Input, Loading, LoginPrompt, MemberAvatar, Modal, Notice, PageHeader, Pill, Section } from '../ui/components'
import { useToast } from '../ui/toast'

const LABEL: Record<Availability, string> = { yes: 'Puedo', maybe: 'Capaz', no: 'No puedo' }

export function Fecha() {
  const { slug, isMember } = useSession()
  const { data: edition, loading } = useEdition()
  const { rows: polls } = useCollection<Poll>(P.polls(slug), [{ field: 'kind', op: '==', value: 'dates' }])
  const members = useMembers()
  const { rows: rsvps } = useCollection<Rsvp>(P.rsvps(slug))
  if (loading || !edition) return <Loading />
  const poll = polls.filter((p) => p.state === 'OPEN' || p.state === 'CLOSED').sort((a, b) => (a.state === 'OPEN' ? -1 : 1) - (b.state === 'OPEN' ? -1 : 1) || b.createdAt - a.createdAt)[0]
  const going = rsvps.filter((r) => r.status === 'YES' && r.planVersion === edition.planVersion).length
  return (
    <div>
      <PageHeader eyebrow={edition.title} title="Fecha y asistencia" intro="Marcá qué días podés. Facu (el presidente) elige la fecha definitiva mirando la disponibilidad." />
      {edition.date.startsAt ? (
        <Card className="mb-4">
          <p className="eyebrow">Fecha confirmada</p>
          <p className="h2 mt-1">
            {fmtDayLong(edition.date.startsAt)} · {fmtTime(edition.date.startsAt)} h
          </p>
          {edition.date.confirmedBy ? (
            <p className="tiny muted mt-1">
              Confirmó {members.aliasOf(edition.date.confirmedBy)} · {fmtDayLong(edition.date.confirmedAt ?? null)}
            </p>
          ) : null}
          {edition.venue?.name ? <p className="small mt-1">{edition.venue.name}</p> : null}
          <p className="small mt-2">
            <b>{going}</b> confirmaron que van.
          </p>
        </Card>
      ) : (
        <Notice>
          Fecha: <b>a definir</b>. Cuando el presidente la confirme, cada uno marca si va.
        </Notice>
      )}

      {edition.date.startsAt ? isMember ? <RsvpCard edition={edition} /> : <LoginPrompt text="Entrá para confirmar si vas." /> : null}

      <Section title="Disponibilidad">
        {poll ? <DateCalendar poll={poll} edition={edition} /> : <Empty title="Todavía no hay fechas para votar" text="Agus carga las fechas candidatas." />}
      </Section>
    </div>
  )
}

interface Cell {
  key: string // YYYY-MM-DD en hora de Buenos Aires
  day: number
  option: PollOption | null
}

function baParts(ms: number) {
  const d = new Date(ms - 3 * 3600000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
}

/** Arma las grillas de cada mes (semana de lunes a domingo) con las fechas candidatas. */
function monthGrids(options: PollOption[]): Array<{ y: number; m: number; cells: Array<Cell | null> }> {
  const byKey = new Map<string, PollOption>()
  const months = new Map<string, { y: number; m: number }>()
  for (const o of options) {
    if (!o.startsAt) continue
    const p = baParts(o.startsAt)
    byKey.set(`${p.y}-${p.m}-${p.d}`, o)
    months.set(`${p.y}-${p.m}`, { y: p.y, m: p.m })
  }
  return Array.from(months.values())
    .sort((a, b) => a.y - b.y || a.m - b.m)
    .map(({ y, m }) => {
      const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
      const lead = (first + 6) % 7
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
      const cells: Array<Cell | null> = Array.from({ length: lead }, () => null)
      for (let d = 1; d <= days; d++) cells.push({ key: `${y}-${m}-${d}`, day: d, option: byKey.get(`${y}-${m}-${d}`) ?? null })
      return { y, m, cells }
    })
}

function AnswerIcon({ v, size = 14 }: { v: Availability | undefined; size?: number }) {
  if (v === 'yes') return <Check size={size} aria-hidden />
  if (v === 'maybe') return <CircleHelp size={size} aria-hidden />
  if (v === 'no') return <X size={size} aria-hidden />
  return null
}

function cellClass(v: Availability | undefined) {
  if (v === 'yes') return 'bg-ok-soft text-ok border-ok/50'
  if (v === 'maybe') return 'bg-warn-soft text-warn border-warn/50'
  if (v === 'no') return 'bg-danger-soft text-danger border-danger/40'
  return 'bg-card border-line'
}

function DateCalendar({ poll, edition }: { poll: Poll; edition: Edition }) {
  const { db, slug, memberId, isMember, isAdmin, canDecide } = useSession()
  const toast = useToast()
  const now = useNow()
  const members = useMembers()
  const electorate = useMemo(() => electorateOf(poll, members), [poll, members])
  const { rows: responses } = useCollection<PollResponse>(P.responses(slug, poll.id))
  const serverMine = useMemo(() => (responses.find((r) => r.id === memberId)?.payload ?? {}) as Record<string, Availability>, [responses, memberId])
  const [mine, setMine] = useState<Record<string, Availability>>({})
  const [pendingSaves, setPendingSaves] = useState(0)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [openOpt, setOpenOpt] = useState<PollOption | null>(null)
  useEffect(() => {
    if (pendingSaves === 0) setMine(serverMine)
  }, [serverMine, pendingSaves])

  const open = isPollOpen(poll, now)
  const canAnswer = open && isMember && !!memberId && electorate.includes(memberId)
  const summaries = useMemo(() => summarizeDates(poll, responses, electorate), [poll, responses, electorate])
  const sumById = useMemo(() => Object.fromEntries(summaries.map((s) => [s.optionId, s])), [summaries])
  const best = useMemo(() => bestDates(summaries, 3), [summaries])
  const bestIds = new Set(best.map((b) => b.optionId))
  const grids = useMemo(() => monthGrids(poll.options), [poll.options])
  const answered = poll.options.filter((o) => mine[o.id]).length
  const pendingCount = poll.options.length - answered
  const confirmedOptionId = poll.decision?.optionId ?? null

  /** Guarda la respuesta de una o varias fechas (sin pisar las demás). null = dejar pendiente. */
  async function save(patch: Record<string, Availability | null>) {
    if (!memberId) return
    const optimistic = { ...mine }
    for (const [k, v] of Object.entries(patch)) {
      if (v) optimistic[k] = v
      else delete optimistic[k]
    }
    setMine(optimistic)
    setPendingSaves((n) => n + 1)
    try {
      await db.runTransaction(async (tx) => {
        const cur = await tx.get<PollResponse>(P.response(slug, poll.id, memberId))
        const payload = { ...((cur?.payload ?? {}) as Record<string, Availability>) }
        for (const [k, v] of Object.entries(patch)) {
          if (v) payload[k] = v
          else delete payload[k]
        }
        tx.set(P.response(slug, poll.id, memberId), { payload, revision: (cur?.revision ?? 0) + 1, updatedAt: Date.now() })
      })
      setSavedAt(Date.now())
    } catch (e) {
      setMine(serverMine)
      toast.error('No se guardó: ' + errorText(e))
    } finally {
      setPendingSaves((n) => n - 1)
    }
  }

  function bulk(v: Availability) {
    const filled = fillPending(poll, mine, v)
    const patch: Record<string, Availability> = {}
    for (const [k, val] of Object.entries(filled)) if (!mine[k]) patch[k] = val
    if (Object.keys(patch).length) void save(patch)
  }

  return (
    <div className="grid gap-4">
      <Card className="!p-3 sm:!p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2 px-1">
          <p className="small">
            {canAnswer ? (
              <>
                Respondiste <b>{answered}</b> de {poll.options.length}
                {pendingCount ? ` · ${pendingCount} pendientes` : ' · ¡completo!'}
              </>
            ) : (
              <span className="muted">Tocá una fecha para ver quién puede.</span>
            )}
          </p>
          <span className="tiny muted" aria-live="polite">
            {pendingSaves > 0 ? 'Guardando…' : savedAt ? 'Guardado ✓' : open ? timeLeft(poll.closeAt, now) : 'Votación cerrada'}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {grids.map((g) => (
            <div key={`${g.y}-${g.m}`}>
              <p className="eyebrow px-1 mb-1">
                {MESES[g.m - 1]} {g.y}
              </p>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <span key={i} className="tiny muted py-1">
                    {d}
                  </span>
                ))}
                {g.cells.map((c, i) => {
                  if (!c) return <span key={'b' + i} />
                  if (!c.option) {
                    return (
                      <span key={c.key} className="aspect-square flex items-center justify-center text-[12px] muted opacity-40">
                        {c.day}
                      </span>
                    )
                  }
                  const o = c.option
                  const v = mine[o.id]
                  const sum = sumById[o.id]
                  const isConfirmed = confirmedOptionId === o.id
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setOpenOpt(o)}
                      className={`relative aspect-square min-h-[42px] rounded-lg border flex flex-col items-center justify-center leading-none ${cellClass(v)} ${bestIds.has(o.id) ? 'ring-2 ring-gold' : ''} ${isConfirmed ? 'outline outline-2 outline-accent' : ''}`}
                      aria-label={`${fmtDayLong(o.startsAt ?? null)}: ${v ? LABEL[v] : 'pendiente'}. ${sum?.yes.length ?? 0} pueden.`}
                    >
                      <span className="font-bold text-[14px]">{c.day}</span>
                      <span className="h-[14px] flex items-center">{v ? <AnswerIcon v={v} size={13} /> : <span className="tiny muted">·</span>}</span>
                      {sum?.yes.length ? <span className="absolute top-0.5 right-1 text-[9px] font-bold text-ok">{sum.yes.length}</span> : null}
                      {isConfirmed ? <Star size={10} className="absolute top-0.5 left-0.5 text-accent" fill="currentColor" aria-hidden /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 tiny muted mt-3 px-1">
          <span className="inline-flex items-center gap-1 text-ok">
            <Check size={12} /> Puedo
          </span>
          <span className="inline-flex items-center gap-1 text-warn">
            <CircleHelp size={12} /> Capaz
          </span>
          <span className="inline-flex items-center gap-1 text-danger">
            <X size={12} /> No puedo
          </span>
          <span>· pendiente</span>
          <span>número verde = cuántos pueden</span>
          <span className="text-accent">marco dorado = de las más votadas</span>
        </div>

        {canAnswer && pendingCount > 0 ? (
          <div className="mt-4 rounded-xl bg-soft/60 p-3">
            <p className="small font-semibold mb-2">Marcar las {pendingCount} pendientes como:</p>
            <div className="grid grid-cols-3 gap-2">
              {(['yes', 'maybe', 'no'] as const).map((v) => (
                <button key={v} type="button" className={`choice justify-center text-center px-2 text-sm min-h-[44px] ${cellClass(v)}`} onClick={() => bulk(v)}>
                  <AnswerIcon v={v} /> {LABEL[v]}
                </button>
              ))}
            </div>
            <p className="tiny muted mt-2">No cambia las fechas que ya respondiste. Después ajustás las excepciones tocando cada día.</p>
          </div>
        ) : null}
        {!isMember ? (
          <div className="mt-4">
            <LoginPrompt text="Entrá para marcar qué días podés." />
          </div>
        ) : null}
      </Card>

      {best.length ? (
        <Card>
          <p className="h3 mb-1">Las fechas con más disponibilidad</p>
          <p className="tiny muted mb-2">"Capaz" no cuenta como confirmado. La decisión la toma el presidente.</p>
          {best.map((b) => {
            const o = poll.options.find((x) => x.id === b.optionId)!
            return (
              <button key={b.optionId} type="button" className="row w-full text-left" onClick={() => setOpenOpt(o)}>
                <span className="font-semibold">
                  {fmtDayLong(o.startsAt ?? null)}
                  {confirmedOptionId === o.id ? <Pill tone="ok" className="ml-2">Confirmada</Pill> : null}
                </span>
                <SummaryCounts s={b} />
              </button>
            )
          })}
        </Card>
      ) : null}

      {isAdmin ? <AdminDates poll={poll} /> : null}

      <Modal open={!!openOpt} onClose={() => setOpenOpt(null)} title={openOpt ? fmtDayLong(openOpt.startsAt ?? null) : ''}>
        {openOpt ? (
          <DateSheet
            option={openOpt}
            summary={sumById[openOpt.id]}
            mine={mine[openOpt.id]}
            canAnswer={canAnswer}
            canDecide={canDecide}
            isAdmin={isAdmin}
            confirmed={confirmedOptionId === openOpt.id}
            onAnswer={(v) => void save({ [openOpt.id]: v })}
            onConfirm={async () => {
              try {
                await confirmDate(db, slug, edition, poll.id, openOpt, memberId!)
                toast.ok('Fecha confirmada')
                setOpenOpt(null)
              } catch (e) {
                toast.error(errorText(e))
              }
            }}
            onRemove={async () => {
              try {
                await db.updateDoc(P.poll(slug, poll.id), { options: poll.options.filter((x) => x.id !== openOpt.id), updatedAt: Date.now() })
                await logAudit(db, slug, memberId!, 'fecha.quitar', openOpt.id)
                setOpenOpt(null)
              } catch (e) {
                toast.error(errorText(e))
              }
            }}
          />
        ) : null}
      </Modal>
    </div>
  )
}

function SummaryCounts({ s }: { s: DateSummary }) {
  return (
    <span className="tiny whitespace-nowrap flex gap-2">
      <span className="text-ok font-bold">✓ {s.yes.length}</span>
      <span className="text-warn">? {s.maybe.length}</span>
      <span className="text-danger">✕ {s.no.length}</span>
      <span className="muted">· {s.pending.length}</span>
    </span>
  )
}

function DateSheet(props: {
  option: PollOption
  summary: DateSummary | undefined
  mine: Availability | undefined
  canAnswer: boolean
  canDecide: boolean
  isAdmin: boolean
  confirmed: boolean
  onAnswer: (v: Availability | null) => void
  onConfirm: () => Promise<void>
  onRemove: () => Promise<void>
}) {
  const { option, summary, mine, canAnswer, canDecide, isAdmin, confirmed } = props
  const members = useMembers()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const groups: Array<[string, string[], string]> = summary
    ? [
        ['Pueden', summary.yes, 'text-ok'],
        ['Capaz', summary.maybe, 'text-warn'],
        ['No pueden', summary.no, 'text-danger'],
        ['Sin responder', summary.pending, 'muted'],
      ]
    : []
  return (
    <div>
      <p className="small muted -mt-1 mb-3">{option.startsAt ? `${fmtTime(option.startsAt)} h · a la noche` : option.detail}</p>
      {canAnswer ? (
        <>
          <p className="label">Tu respuesta</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tu respuesta">
            {(['yes', 'maybe', 'no'] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={mine === v} className={`choice justify-center text-center px-2 min-h-[52px] ${mine === v ? cellClass(v) : ''}`} onClick={() => props.onAnswer(v)}>
                <AnswerIcon v={v} size={16} /> {LABEL[v]}
              </button>
            ))}
          </div>
          {mine ? (
            <button type="button" className="tiny underline muted mt-2 min-h-[36px]" onClick={() => props.onAnswer(null)}>
              Dejarla pendiente
            </button>
          ) : (
            <p className="tiny muted mt-2">Todavía no respondiste esta fecha.</p>
          )}
        </>
      ) : null}

      <div className="mt-4 grid gap-3">
        {groups.map(([title, ids, cls]) => (
          <div key={title}>
            <p className={`small font-bold ${cls}`}>
              {title} ({ids.length})
            </p>
            {ids.length ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ids.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-bg border border-line pl-0.5 pr-2 py-0.5 tiny">
                    <MemberAvatar id={id} size={20} /> {members.aliasOf(id)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {canDecide ? (
        <div className="mt-5 pt-4 border-t border-line flex gap-2 flex-wrap">
          {confirmed ? (
            <Pill tone="ok">Es la fecha confirmada</Pill>
          ) : (
            <Button variant="gold" onClick={() => setConfirmOpen(true)}>
              Confirmar esta fecha
            </Button>
          )}
          {isAdmin && !confirmed ? (
            <Button variant="line" onClick={() => setRemoveOpen(true)}>
              Quitar esta fecha
            </Button>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar fecha definitiva"
        text={`La comida anual queda el ${fmtDayLong(option.startsAt ?? null)}. Toda la banda lo va a ver como confirmado y cada uno marca si va.`}
        confirmLabel="Confirmar"
        onConfirm={async () => {
          await props.onConfirm()
          setConfirmOpen(false)
        }}
      />
      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title="Quitar fecha"
        text="La fecha deja de aparecer en el calendario."
        danger
        confirmLabel="Quitar"
        onConfirm={async () => {
          await props.onRemove()
          setRemoveOpen(false)
        }}
      />
    </div>
  )
}

function AdminDates({ poll }: { poll: Poll }) {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('21:00')
  async function add() {
    const ms = localToMs(date, time)
    if (!ms) return toast.error('Elegí una fecha.')
    const id = 'd-' + date
    if (poll.options.some((o) => o.id === id)) return toast.error('Esa fecha ya está.')
    const opt: PollOption = { id, label: fmtDayLong(ms), detail: 'A la noche', startsAt: ms, special: null }
    const options = [...poll.options, opt].sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
    try {
      await db.updateDoc(P.poll(slug, poll.id), { options, updatedAt: Date.now() })
      await logAudit(db, slug, memberId!, 'fecha.agregar', id)
      setDate('')
      toast.ok('Fecha agregada')
    } catch (e) {
      toast.error(errorText(e))
    }
  }
  return (
    <Card>
      <p className="h3 mb-1">Agregar una fecha (sólo vos)</p>
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <Field label="Día" id="add-date">
          <Input id="add-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hora" id="add-time">
          <Input id="add-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Button variant="line" onClick={() => void add()} disabled={!date}>
        Agregar
      </Button>
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
      <p className="tiny muted mt-3">Tu asistencia no cambia el amigo invisible: participás igual aunque no vengas.</p>
    </Card>
  )
}

