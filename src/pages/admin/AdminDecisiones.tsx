// Decisiones: crear y manejar consultas (fechas, comida, lugar, salida, monto, otras) y revisar propuestas.
import { useMemo, useState } from 'react'
import { DESEMPATE_LOGISTICO_HORAS, QUORUM_LOGISTICO_PCT, REGALO_MONTOS_BORRADOR } from '../../content/config'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit, pushNews, setDecision } from '../../data/actions'
import { DataError } from '../../data/adapter'
import { electorateOf, useCollection, useEdition, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import type { GiftCampaign, Poll, PollKind, PollOption, PollResponse, Rsvp } from '../../data/types'
import { formatArs } from '../../domain/expenses'
import { fmtDateTime, fmtDayLong, fmtTime, hoursFromNow, localToMs, msToLocalParts } from '../../domain/format'
import { isPollOpen, leaders, participation, recommendDates, tallyApproval, tallyAvailability, tallySingle } from '../../domain/polls'
import { Button, Card, ConfirmDialog, Field, Input, Modal, Notice, Pill, Section, Textarea } from '../../ui/components'
import { useToast } from '../../ui/toast'

const KINDS: Array<{ value: PollKind; label: string; method: Poll['method']; decision: string | null }> = [
  { value: 'dates', label: 'Fechas (disponibilidad)', method: 'AVAILABILITY', decision: 'fecha' },
  { value: 'food', label: 'Comida (aprobación múltiple)', method: 'APPROVAL', decision: 'menu' },
  { value: 'venue', label: 'Lugar (aprobación múltiple)', method: 'APPROVAL', decision: 'lugar' },
  { value: 'afterparty', label: 'Salida (aprobación múltiple)', method: 'APPROVAL', decision: 'salida' },
  { value: 'gift_amount', label: 'Monto del regalo (voto único)', method: 'SINGLE', decision: 'regalo' },
  { value: 'custom', label: 'Otra consulta (voto único)', method: 'SINGLE', decision: null },
]

export function AdminDecisiones() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { data: edition } = useEdition()
  const { rows: polls } = useCollection<Poll>(P.polls(slug))
  const { rows: rsvps } = useCollection<Rsvp>(P.rsvps(slug))
  const [createOpen, setCreateOpen] = useState(false)
  const [kind, setKind] = useState<PollKind>('dates')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState<Array<{ label: string; detail: string; date: string; time: string }>>([{ label: '', detail: '', date: '', time: '21:00' }])
  const [closeDate, setCloseDate] = useState('')
  const [closeTime, setCloseTime] = useState('23:59')
  const [quorum, setQuorum] = useState(QUORUM_LOGISTICO_PCT)
  const [includeNone, setIncludeNone] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const sorted = useMemo(() => [...polls].sort((a, b) => b.createdAt - a.createdAt), [polls])

  function resetForm(k: PollKind = 'dates') {
    setKind(k)
    const def = KINDS.find((x) => x.value === k)!
    setTitle(k === 'dates' ? '¿Qué día nos juntamos?' : k === 'gift_amount' ? '¿Cuánto ponemos para el amigo invisible?' : k === 'food' ? '¿Qué comemos?' : k === 'venue' ? '¿Dónde?' : k === 'afterparty' ? '¿A dónde seguimos?' : '')
    setDescription(k === 'dates' ? 'Marcá todas las fechas en las que podés. Estar disponible todavía no confirma asistencia.' : def.method === 'APPROVAL' ? 'Podés aprobar todas las opciones que te sirvan.' : '')
    setOptions(
      k === 'gift_amount'
        ? REGALO_MONTOS_BORRADOR.map((n) => ({ label: formatArs(n * 100), detail: '', date: '', time: '' }))
        : [{ label: '', detail: '', date: '', time: '21:00' }],
    )
    setIncludeNone(false)
  }

  function electorateFor(k: PollKind): string[] {
    const base = members.active.filter((m) => m.participating).map((m) => m.id)
    if (k === 'afterparty') {
      const joiners = rsvps.filter((r) => r.afterparty === 'JOIN').map((r) => r.id)
      return joiners.length ? base.filter((id) => joiners.includes(id)) : base
    }
    return base
  }

  async function createPoll(publish: boolean) {
    const def = KINDS.find((x) => x.value === kind)!
    const opts: PollOption[] = options
      .filter((o) => (kind === 'dates' ? o.date : o.label.trim()))
      .map((o, i) => {
        const startsAt = kind === 'dates' ? localToMs(o.date, o.time) : null
        return { id: 'o' + (i + 1) + '-' + db.newId().slice(0, 4).toLowerCase(), label: kind === 'dates' ? (o.label.trim() || fmtDayLong(startsAt!)) : o.label.trim(), detail: o.detail.trim(), startsAt, special: null }
      })
    if (includeNone && def.method !== 'AVAILABILITY') opts.push({ id: 'none-' + db.newId().slice(0, 4).toLowerCase(), label: 'No me sirve ninguna', special: 'NONE' })
    if (opts.length < 2) {
      toast.error('Hacen falta al menos dos opciones.')
      return
    }
    if (kind === 'gift_amount' && opts.some((o) => o.special !== 'NONE' && !/\d/.test(o.label))) {
      toast.error('Las opciones de monto tienen que ser números.')
      return
    }
    const closeAt = localToMs(closeDate, closeTime)
    if (publish && !closeAt) {
      toast.error('Definí la fecha de cierre para publicar.')
      return
    }
    const electorate = electorateFor(kind)
    if (publish && electorate.length === 0) {
      toast.error('No hay electores activos.')
      return
    }
    setBusy('create')
    try {
      const id = db.newId()
      const now = Date.now()
      const poll: Poll = {
        id,
        kind,
        title: title.trim() || def.label,
        description: description.trim(),
        method: def.method,
        state: publish ? 'OPEN' : 'DRAFT',
        options: opts,
        electorate: publish ? electorate : [],
        audience: kind === 'afterparty' ? 'AFTERPARTY' : 'ALL',
        openAt: publish ? now : null,
        closeAt,
        quorumPct: quorum,
        version: 1,
        closure: null,
        decision: null,
        createdAt: now,
        updatedAt: now,
      }
      await db.setDoc(P.poll(slug, id), poll)
      if (publish && def.decision) await setDecision(db, slug, def.decision, { status: 'VOTING', pollId: id })
      if (publish) {
        await pushNews(db, slug, `Nueva consulta: ${poll.title}. Cierra ${fmtDateTime(closeAt)}.`)
        if (edition?.state === 'DRAFT') await db.updateDoc(P.edition(slug), { state: 'ORGANIZING', updatedAt: now })
      }
      await logAudit(db, slug, memberId!, publish ? 'poll.publish' : 'poll.draft', id)
      setCreateOpen(false)
      toast.ok(publish ? 'Consulta publicada' : 'Borrador guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function publishDraft(p: Poll) {
    const electorate = electorateFor(p.kind)
    if (!p.closeAt) {
      toast.error('El borrador no tiene fecha de cierre. Editalo (Nueva versión) y definila.')
      return
    }
    if (electorate.length === 0) {
      toast.error('No hay electores activos.')
      return
    }
    setBusy(p.id)
    try {
      await db.updateDoc(P.poll(slug, p.id), { state: 'OPEN', electorate, openAt: Date.now(), updatedAt: Date.now(), version: p.version + 1 })
      const def = KINDS.find((x) => x.value === p.kind)
      if (def?.decision) await setDecision(db, slug, def.decision, { status: 'VOTING', pollId: p.id })
      await pushNews(db, slug, `Nueva consulta: ${p.title}. Cierra ${fmtDateTime(p.closeAt)}.`)
      await logAudit(db, slug, memberId!, 'poll.publish', p.id)
      toast.ok('Publicada')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function closePoll(p: Poll, reason: string) {
    setBusy(p.id)
    try {
      const responses = await db.getCollection<PollResponse>(P.responses(slug, p.id))
      const part = participation(p, responses.length, electorateOf(p, members).length)
      await db.runTransaction(async (tx) => {
        const cur = await tx.get<Poll>(P.poll(slug, p.id))
        if (!cur) throw new DataError('NOT_FOUND')
        if (cur.state === 'CLOSED') return
        if (cur.state !== 'OPEN') throw new DataError('STATE_CONFLICT', 'La consulta no está abierta.')
        tx.update(P.poll(slug, p.id), { state: 'CLOSED', closure: { count: responses.length, closedAt: Date.now(), lowParticipation: !part.quorumMet, reason }, updatedAt: Date.now(), version: cur.version + 1 })
      })
      await logAudit(db, slug, memberId!, 'poll.close', p.id, reason)
      toast.ok(`Cerrada con ${responses.length} respuestas${part.quorumMet ? '' : ' (baja participación)'}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function voidPoll(p: Poll, reason: string) {
    setBusy(p.id)
    try {
      await db.updateDoc(P.poll(slug, p.id), { state: 'VOID', updatedAt: Date.now(), version: p.version + 1 })
      const def = KINDS.find((x) => x.value === p.kind)
      if (def?.decision && edition?.decisions[def.decision]?.pollId === p.id) await setDecision(db, slug, def.decision, { status: 'UNDEFINED' })
      await logAudit(db, slug, memberId!, 'poll.void', p.id, reason)
      toast.ok('Anulada')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function newVersion(p: Poll) {
    const id = db.newId()
    const now = Date.now()
    const clone: Poll = { ...p, id, state: 'DRAFT', electorate: [], openAt: null, closure: null, decision: null, version: 1, parentPollId: p.id, createdAt: now, updatedAt: now }
    await db.setDoc(P.poll(slug, id), clone)
    toast.ok('Nueva versión en borrador. Agregá opciones y publicala.')
  }

  async function confirmDecision(p: Poll, optionId: string, reason: string) {
    const def = KINDS.find((x) => x.value === p.kind)
    const opt = p.options.find((o) => o.id === optionId)
    if (!opt) return
    setBusy(p.id)
    try {
      const now = Date.now()
      await db.updateDoc(P.poll(slug, p.id), { decision: { optionId, reason, by: memberId, at: now }, updatedAt: now })
      if (p.kind === 'dates' && opt.startsAt) {
        const changing = !!edition?.date.startsAt && edition.date.startsAt !== opt.startsAt
        await db.updateDoc(P.edition(slug), {
          date: { startsAt: opt.startsAt, label: opt.detail ?? '', confirmedAt: now, confirmedBy: memberId, reason },
          planVersion: changing ? (edition?.planVersion ?? 1) + 1 : (edition?.planVersion ?? 1),
          state: edition?.state === 'DRAFT' || edition?.state === 'ORGANIZING' ? 'CONFIRMED' : edition?.state,
          updatedAt: now,
        })
        await setDecision(db, slug, 'fecha', { status: 'CONFIRMED', label: `${fmtDayLong(opt.startsAt)} · ${fmtTime(opt.startsAt)} h`, confirmedBy: memberId, confirmedAt: now, reason, pollId: p.id })
        await pushNews(db, slug, `Fecha confirmada: ${fmtDayLong(opt.startsAt)} a las ${fmtTime(opt.startsAt)} h. Confirmá tu asistencia.`)
      } else if (p.kind === 'gift_amount') {
        const cents = Number(opt.label.replace(/[^\d]/g, '')) * 100
        const gift = await db.getDoc<GiftCampaign>(P.gift(slug))
        await db.updateDoc(P.gift(slug), { amountCents: cents, budgetVersion: (gift?.budgetVersion ?? 1) + 1, updatedAt: now })
        await setDecision(db, slug, 'regalo', { status: 'CONFIRMED', label: formatArs(cents), confirmedBy: memberId, confirmedAt: now, reason, pollId: p.id })
        await pushNews(db, slug, `Monto del amigo invisible: ${formatArs(cents)}.`)
      } else if (p.kind === 'food') {
        await db.updateDoc(P.edition(slug), { menu: { name: opt.label, modality: opt.detail ?? '' }, updatedAt: now })
        await setDecision(db, slug, 'menu', { status: 'CONFIRMED', label: opt.label, confirmedBy: memberId, confirmedAt: now, reason, pollId: p.id })
        await pushNews(db, slug, `Menú confirmado: ${opt.label}.`)
      } else if (p.kind === 'venue') {
        await db.updateDoc(P.edition(slug), { venue: { name: opt.label, notes: opt.detail ?? '', reserved: false }, updatedAt: now })
        await setDecision(db, slug, 'lugar', { status: 'PENDING_RESERVATION', label: opt.label, confirmedBy: memberId, confirmedAt: now, reason, pollId: p.id })
        await pushNews(db, slug, `Lugar elegido: ${opt.label}. Falta confirmar la reserva.`)
      } else if (p.kind === 'afterparty') {
        await db.updateDoc(P.edition(slug), { afterparty: { name: opt.label, zone: opt.detail ?? '', reserved: false }, updatedAt: now })
        await setDecision(db, slug, 'salida', { status: 'PENDING_RESERVATION', label: opt.label, confirmedBy: memberId, confirmedAt: now, reason, pollId: p.id })
      } else if (def?.decision) {
        await setDecision(db, slug, def.decision, { status: 'CONFIRMED', label: opt.label, confirmedBy: memberId, confirmedAt: now, reason, pollId: p.id })
      }
      await logAudit(db, slug, memberId!, 'decision.confirm', p.id, reason)
      toast.ok('Decisión confirmada')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function runoff(p: Poll, leaderIds: string[]) {
    const id = db.newId()
    const now = Date.now()
    const poll: Poll = {
      ...p,
      id,
      title: `${p.title} (desempate)`,
      description: 'Segunda vuelta entre las opciones empatadas.',
      method: 'SINGLE',
      state: 'OPEN',
      options: p.options.filter((o) => leaderIds.includes(o.id)),
      openAt: now,
      closeAt: hoursFromNow(DESEMPATE_LOGISTICO_HORAS, now),
      closure: null,
      decision: null,
      version: 1,
      parentPollId: p.id,
      createdAt: now,
      updatedAt: now,
    }
    await db.setDoc(P.poll(slug, id), poll)
    await pushNews(db, slug, `Desempate abierto: ${p.title}.`)
    await logAudit(db, slug, memberId!, 'poll.runoff', id)
    toast.ok('Desempate publicado por 48 h')
  }


  return (
    <div className="grid gap-4">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="gold"
          onClick={() => {
            resetForm('dates')
            setCreateOpen(true)
          }}
        >
          Nueva consulta
        </Button>
      </div>

      <Section title="Consultas" className="mt-0">
        {sorted.length === 0 ? <Notice>Todavía no hay consultas. Empezá por las fechas.</Notice> : null}
        <div className="grid gap-3">
          {sorted.map((p) => (
            <PollAdminCard key={p.id} poll={p} busy={busy === p.id} aliasOf={members.aliasOf} onPublish={() => void publishDraft(p)} onClose={(r) => void closePoll(p, r)} onVoid={(r) => void voidPoll(p, r)} onNewVersion={() => void newVersion(p)} onConfirm={(o, r) => void confirmDecision(p, o, r)} onRunoff={(ids) => void runoff(p, ids)} />
          ))}
        </div>
      </Section>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva consulta" wide>
        <Field label="Tipo" id="np-kind">
          <select id="np-kind" className="input" value={kind} onChange={(e) => resetForm(e.target.value as PollKind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Título" id="np-title">
          <Input id="np-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Descripción" id="np-desc">
          <Textarea id="np-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <p className="label">Opciones</p>
        {options.map((o, i) => (
          <div key={i} className={`grid gap-2 mb-3 pb-3 border-b border-line sm:border-0 sm:pb-0 sm:mb-2 ${kind === 'dates' ? 'grid-cols-[minmax(0,1fr)_110px] sm:grid-cols-[1fr_110px_1fr_auto]' : 'grid-cols-1 sm:grid-cols-[1fr_1fr_auto]'}`}>
            {kind === 'dates' ? (
              <>
                <Input type="date" aria-label="Día" value={o.date} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
                <Input type="time" aria-label="Hora" value={o.time} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
                <Input placeholder="Comentario" aria-label="Comentario" value={o.detail} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} />
              </>
            ) : (
              <>
                <Input placeholder="Opción" aria-label="Opción" value={o.label} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <Input placeholder="Detalle" aria-label="Detalle" value={o.detail} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} />
              </>
            )}
            <Button size="sm" variant="line" aria-label="Quitar opción" onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}>
              ×
            </Button>
          </div>
        ))}
        <Button size="sm" variant="line" onClick={() => setOptions((os) => [...os, { label: '', detail: '', date: '', time: '21:00' }])}>
          + Opción
        </Button>
        {kind !== 'dates' ? (
          <label className="flex items-center gap-2 small mt-3">
            <input type="checkbox" checked={includeNone} onChange={(e) => setIncludeNone(e.target.checked)} /> Incluir "No me sirve ninguna"
          </label>
        ) : null}
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_110px_100px] gap-2 mt-4">
          <Field label="Cierra el" id="np-cd">
            <Input id="np-cd" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </Field>
          <Field label="Hora" id="np-ct">
            <Input id="np-ct" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
          </Field>
          <Field label="Quórum %" id="np-q">
            <Input id="np-q" type="number" min={0} max={100} value={quorum} onChange={(e) => setQuorum(Number(e.target.value))} />
          </Field>
        </div>
        <p className="tiny muted mb-3">Electores al publicar: {electorateFor(kind).length} miembros activos que participan{kind === 'afterparty' ? ' y marcaron "me sumo a salir"' : ''}. El padrón se congela al abrir.</p>
        <div className="flex gap-2">
          <Button variant="gold" onClick={() => void createPoll(true)} loading={busy === 'create'}>
            Publicar
          </Button>
          <Button variant="line" onClick={() => void createPoll(false)} loading={busy === 'create'}>
            Guardar borrador
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function PollAdminCard({ poll, busy, aliasOf, onPublish, onClose, onVoid, onNewVersion, onConfirm, onRunoff }: { poll: Poll; busy: boolean; aliasOf: (id: string) => string; onPublish: () => void; onClose: (reason: string) => void; onVoid: (reason: string) => void; onNewVersion: () => void; onConfirm: (optionId: string, reason: string) => void; onRunoff: (ids: string[]) => void }) {
  const { slug } = useSession()
  const members = useMembers()
  const electorate = electorateOf(poll, members)
  const { rows: responses } = useCollection<PollResponse>(P.responses(slug, poll.id))
  const [closeOpen, setCloseOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [confirmOpt, setConfirmOpt] = useState<string | null>(null)
  const now = Date.now()
  const open = isPollOpen(poll, now)
  const part = participation(poll, responses.length, electorate.length)
  const counts = poll.method === 'AVAILABILITY' ? null : poll.method === 'APPROVAL' ? tallyApproval(poll, responses) : tallySingle(poll, responses)
  const rows = poll.method === 'AVAILABILITY' ? tallyAvailability(poll, responses) : null
  const rec = rows ? recommendDates(rows) : null
  const lead = counts ? leaders(counts) : rec?.leaders ?? []
  const parts = msToLocalParts(poll.closeAt)
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="h3">
            {poll.title} <span className="tiny muted font-normal">· {KINDS.find((k) => k.value === poll.kind)?.label}</span>
          </p>
          <p className="tiny muted">
            {poll.state === 'OPEN' ? (open ? `Abierta · cierra ${parts.date} ${parts.time}` : 'Vencida, sin cerrar') : poll.state} · respondieron {responses.length} de {electorate.length} ({part.pct}%)
            {poll.closure?.lowParticipation ? ' · baja participación' : ''}
          </p>
        </div>
        <span className="flex gap-1 flex-wrap">
          {poll.state === 'DRAFT' ? (
            <Button size="sm" variant="gold" onClick={onPublish} loading={busy}>
              Publicar
            </Button>
          ) : null}
          {poll.state === 'OPEN' ? (
            <Button size="sm" onClick={() => setCloseOpen(true)} loading={busy}>
              Cerrar
            </Button>
          ) : null}
          {poll.state !== 'VOID' ? (
            <Button size="sm" variant="line" onClick={onNewVersion}>
              Nueva versión
            </Button>
          ) : null}
          {poll.state !== 'VOID' && poll.state !== 'CLOSED' ? (
            <Button size="sm" variant="line" onClick={() => setVoidOpen(true)}>
              Anular
            </Button>
          ) : null}
        </span>
      </div>
      <div className="mt-3 grid gap-1">
        {poll.options.map((o) => {
          const r = rows?.find((x) => x.optionId === o.id)
          const n = counts?.[o.id] ?? 0
          const isLeader = lead.includes(o.id)
          return (
            <div key={o.id} className="flex items-center justify-between gap-2 small py-1 border-t border-line">
              <span>
                {o.startsAt ? `${fmtDayLong(o.startsAt)} ${fmtTime(o.startsAt)}` : o.label} {o.detail ? <span className="tiny muted">· {o.detail}</span> : null}
                {isLeader && poll.state !== 'DRAFT' ? <Pill className="ml-2">{lead.length > 1 ? 'Empate' : 'Líder'}</Pill> : null}
                {poll.decision?.optionId === o.id ? <Pill tone="ok" className="ml-2">Oficial</Pill> : null}
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="tiny muted">{r ? `${r.yes} puedo · ${r.maybe} capaz · ${r.no} no` : `${n}`}</span>
                {poll.state === 'CLOSED' && !poll.decision ? (
                  <Button size="sm" variant="line" onClick={() => setConfirmOpt(o.id)}>
                    Confirmar
                  </Button>
                ) : null}
              </span>
            </div>
          )
        })}
      </div>
      {poll.state === 'CLOSED' && !poll.decision && lead.length > 1 && poll.method !== 'AVAILABILITY' ? (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Notice tone="warn">Empate entre {lead.length} opciones.</Notice>
          <Button size="sm" variant="line" onClick={() => onRunoff(lead)}>
            Abrir desempate (48 h)
          </Button>
        </div>
      ) : null}
      {poll.state === 'CLOSED' && !poll.decision && rec && !rec.viable ? <Notice tone="danger">Ninguna opción viable: creá una nueva consulta.</Notice> : null}
      {poll.decision ? (
        <p className="tiny muted mt-2">
          Decisión confirmada por {aliasOf(poll.decision.by)} · {fmtDateTime(poll.decision.at)} {poll.decision.reason ? `· ${poll.decision.reason}` : ''}
        </p>
      ) : null}
      <ConfirmDialog open={closeOpen} onClose={() => setCloseOpen(false)} title="Cerrar consulta" text={part.quorumMet ? `Respondieron ${responses.length} de ${electorate.length}. Se cierra y queda la recomendación para confirmar.` : `Quórum no alcanzado (${part.pct}% de ${poll.quorumPct}%). Se cierra como baja participación; podés confirmar igual con motivo.`} requireReason={!part.quorumMet} confirmLabel="Cerrar" onConfirm={(r) => { onClose(r); setCloseOpen(false) }} />
      <ConfirmDialog open={voidOpen} onClose={() => setVoidOpen(false)} title="Anular consulta" text="Las respuestas quedan guardadas pero la consulta deja de valer." requireReason danger confirmLabel="Anular" onConfirm={(r) => { onVoid(r); setVoidOpen(false) }} />
      <ConfirmDialog open={!!confirmOpt} onClose={() => setConfirmOpt(null)} title="Confirmar decisión oficial" text={`Opción: ${poll.options.find((o) => o.id === confirmOpt)?.label ?? ''}. ${lead.includes(confirmOpt ?? '') ? '' : 'No es la opción líder: explicá el motivo.'}`} requireReason={!lead.includes(confirmOpt ?? '') || !!poll.closure?.lowParticipation} confirmLabel="Confirmar" onConfirm={(r) => { if (confirmOpt) onConfirm(confirmOpt, r); setConfirmOpt(null) }} />
    </Card>
  )
}
