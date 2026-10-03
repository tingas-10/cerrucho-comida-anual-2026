// Inicio: hero, pendientes personales, el plan y novedades.
import { Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TEXTOS } from '../content/config'
import { FOTOS } from '../content/galeria'
import { useSession } from '../data/DataContext'
import { electorateOf, useCollection, useDoc, useDocs, useEdition, useMembers, useNow } from '../data/hooks'
import { P } from '../data/paths'
import type { Award, Ballot, BeverageProfile, GiftCampaign, GiftParticipant, Member, Poll, PollResponse, Proposal, Rsvp, Task } from '../data/types'
import { countdown, fmtDayLong, fmtTime, timeLeft } from '../domain/format'
import { isPollOpen, participation } from '../domain/polls'
import { Button, Card, Loading, Pill, Section } from '../ui/components'
import { useToast } from '../ui/toast'

const BASE = import.meta.env.BASE_URL

interface Pending {
  key: string
  title: string
  text: string
  to: string
  closeAt: number | null
  cta: string
}

export function Inicio() {
  const { slug, memberId, isAdmin } = useSession()
  const now = useNow()
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  const { rows: polls } = useCollection<Poll>(P.polls(slug))
  const { rows: awards } = useCollection<Award>(P.awards(slug))
  const { rows: rsvps } = useCollection<Rsvp>(P.rsvps(slug))
  const { rows: tasks } = useCollection<Task>(P.tasks(slug))
  const { rows: proposals } = useCollection<Proposal>(P.proposals(slug))
  const { data: gift } = useDoc<GiftCampaign>(P.gift(slug))
  const myRsvp = useDoc<Rsvp>(memberId ? P.rsvp(slug, memberId) : null)
  const myBev = useDoc<BeverageProfile>(memberId ? P.beverage(slug, memberId) : null)
  const myGift = useDoc<GiftParticipant>(memberId ? P.giftParticipant(slug, memberId) : null)
  const openPolls = polls.filter((p) => isPollOpen(p, now) && memberId && electorateOf(p, members).includes(memberId))
  const { docs: myResponses } = useDocs<PollResponse>(memberId ? openPolls.map((p) => P.response(slug, p.id, memberId)) : [])
  const openAwards = awards.filter((a) => (a.state === 'ROUND1_OPEN' || a.state === 'ROUND2_OPEN') && memberId && a.electorate.includes(memberId))
  const { docs: myBallots } = useDocs<Ballot>(memberId ? openAwards.map((a) => P.ballot(slug, a.code, memberId)) : [])

  const pending = useMemo<Pending[]>(() => {
    if (!edition || !memberId) return []
    const out: Pending[] = []
    const e = `/e/${slug}`
    for (const p of openPolls) {
      if (myResponses[P.response(slug, p.id, memberId)]) continue
      const to = p.kind === 'dates' ? `${e}/fecha` : p.kind === 'gift_amount' ? `${e}/amigo-invisible` : p.kind === 'afterparty' ? `${e}/agenda` : `${e}/comida`
      out.push({ key: 'poll-' + p.id, title: p.title, text: p.kind === 'dates' ? 'Marcá cuándo podés. Estar disponible todavía no confirma asistencia.' : 'Tu respuesta define la decisión del grupo.', to, closeAt: p.closeAt, cta: 'Responder' })
    }
    if (edition.date.startsAt) {
      const r = myRsvp.data
      if (!r || r.planVersion !== edition.planVersion) {
        out.push({ key: 'rsvp', title: r ? 'Reconfirmá tu asistencia' : 'Confirmá si venís', text: r ? 'Cambió el plan: hay que volver a confirmar.' : `${fmtDayLong(edition.date.startsAt)} · ${fmtTime(edition.date.startsAt)} h`, to: `${e}/fecha`, closeAt: null, cta: 'Confirmar' })
      }
      if (edition.beverage.state === 'OPEN' && !myBev.data && (r?.status === 'YES' || !r)) {
        out.push({ key: 'bev', title: 'Qué vas a tomar', text: 'Repartí el 100% y estimá tus porciones para calcular compras.', to: `${e}/bebidas`, closeAt: edition.beverage.closeAt ?? null, cta: 'Completar' })
      }
    }
    if (gift?.state === 'ENROLLMENT_OPEN' && !myGift.data?.accepted) {
      out.push({ key: 'gift', title: 'Amigo invisible: ¿te sumás?', text: 'Aceptá el monto y la fecha límite para entrar al sorteo.', to: `${e}/amigo-invisible`, closeAt: gift.enrollCloseAt, cta: 'Me sumo' })
    }
    const missingR1 = openAwards.filter((a) => a.state === 'ROUND1_OPEN' && !myBallots[P.ballot(slug, a.code, memberId)]?.r1)
    const missingR2 = openAwards.filter((a) => a.state === 'ROUND2_OPEN' && !myBallots[P.ballot(slug, a.code, memberId)]?.r2)
    if (missingR1.length) out.push({ key: 'awards1', title: `Premios: te faltan ${missingR1.length} categorías`, text: 'Un voto por categoría. Nadie ve tu voto.', to: `${e}/premios`, closeAt: Math.min(...missingR1.map((a) => a.round1?.closeAt ?? Infinity)) || null, cta: 'Votar' })
    if (missingR2.length) out.push({ key: 'awards2', title: `Ballotage: ${missingR2.length} categorías`, text: 'Segunda vuelta entre los finalistas.', to: `${e}/premios`, closeAt: Math.min(...missingR2.map((a) => a.round2?.closeAt ?? Infinity)) || null, cta: 'Votar' })
    for (const t of tasks) {
      const v = t.volunteers?.[memberId]
      if (v && v.status === 'OFFERED' && t.status === 'OPEN') out.push({ key: 'task-' + t.id, title: `Te comprometiste: ${t.title}`, text: 'Marcá cuando esté hecho.', to: `${e}/tareas`, closeAt: t.dueAt ?? null, cta: 'Ver tarea' })
    }
    return out.sort((a, b) => (a.closeAt ?? Infinity) - (b.closeAt ?? Infinity)).slice(0, 8)
  }, [edition, memberId, slug, openPolls, myResponses, myRsvp.data, myBev.data, gift, myGift.data, openAwards, myBallots, tasks])

  if (loading || !edition) return <Loading />
  const confirmed = rsvps.filter((r) => r.status === 'YES' && r.planVersion === edition.planVersion).length
  const participants = members.active.filter((m) => m.participating)
  const answered = rsvps.filter((r) => r.planVersion === edition.planVersion).length
  const cd = edition.date.startsAt ? countdown(edition.date.startsAt, now) : null
  const hero = BASE + (edition.heroPhoto ?? FOTOS[0].src)

  return (
    <div>
      <div className="relative rounded-[20px] overflow-hidden min-h-[300px] sm:min-h-[340px] flex items-end p-6 sm:p-9 text-white" style={{ background: `linear-gradient(0deg, rgba(8,10,17,.92), rgba(8,10,17,.1)), url(${hero}) center 45% / cover` }}>
        <div>
          <p className="eyebrow text-[#f2e7c8]">{edition.title}</p>
          <h1 className="hero-title mt-2 mb-3 max-w-3xl">La Banda<br />del cerrucho.</h1>
          {edition.date.startsAt ? (
            <div className="text-[#f2e7c8]">
              <p className="font-semibold text-lg">
                {fmtDayLong(edition.date.startsAt)} · {fmtTime(edition.date.startsAt)} h{edition.venue?.name ? ` · ${edition.venue.name}` : ''}
              </p>
              {cd ? (
                <p className="small mt-1">
                  Faltan {cd.days} días, {cd.hours} h y {cd.minutes} min
                </p>
              ) : (
                <p className="small mt-1">¡Es hoy!</p>
              )}
            </div>
          ) : (
            <p className="text-[#f2e7c8] max-w-xl">{TEXTOS.heroSinFecha}</p>
          )}
        </div>
      </div>

      <Section title="Mis pendientes" aside={<span className="tiny muted">{pending.length === 0 ? 'Estás al día' : `${pending.length} por hacer`}</span>}>
        {pending.length === 0 ? (
          <Card>
            <p className="font-semibold">No tenés nada pendiente.</p>
            <p className="small muted">Cuando se abra algo nuevo, aparece acá y te avisamos por el grupo.</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pending.map((p) => (
              <Card key={p.key} className="flex flex-col">
                <div className="flex justify-between gap-2">
                  <Pill>Pendiente</Pill>
                  {p.closeAt ? <span className="tiny muted">{timeLeft(p.closeAt, now)}</span> : null}
                </div>
                <p className="h3 mt-3">{p.title}</p>
                <p className="small muted mt-1 flex-1">{p.text}</p>
                <Link to={p.to} className="btn mt-4 self-start">
                  {p.cta}
                </Link>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 mt-8">
        <Section title="El plan" className="mt-0">
          <Card>
            {(['fecha', 'lugar', 'menu', 'regalo', 'premios', 'salida'] as const).map((k) => {
              const d = edition.decisions[k]
              const labels: Record<string, string> = { fecha: 'Fecha', lugar: 'Lugar', menu: 'Menú', regalo: 'Regalo', premios: 'Premios', salida: 'Salida' }
              return (
                <div key={k} className="row">
                  <div>
                    <p className="font-semibold">{labels[k]}</p>
                    {d?.label ? <p className="small muted">{d.label}</p> : null}
                    {d?.status === 'CONFIRMED' && d.confirmedBy ? (
                      <p className="tiny muted">
                        Confirmó {members.aliasOf(d.confirmedBy)} {d.confirmedAt ? `· ${fmtDayLong(d.confirmedAt)}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <DecisionPill status={d?.status ?? 'UNDEFINED'} />
                </div>
              )
            })}
          </Card>
        </Section>
        <Section title="La banda" className="mt-0">
          <Card>
            <div className="row">
              <span>Asistentes confirmados</span>
              <b>{edition.date.startsAt ? confirmed : '—'}</b>
            </div>
            <div className="row">
              <span>Respuestas pendientes</span>
              <b>{edition.date.startsAt ? Math.max(0, participants.length - answered) : '—'}</b>
            </div>
            <div className="row">
              <span>Participan este año</span>
              <b>{participants.length}</b>
            </div>
          </Card>
          {edition.news.length ? (
            <Card className="mt-3">
              <p className="h3 mb-2">Novedades</p>
              {edition.news.slice(0, 5).map((n, i) => (
                <p key={i} className="small py-1.5 border-b border-line last:border-0">
                  <span className="tiny muted block">{fmtDayLong(n.at)}</span>
                  {n.text}
                </p>
              ))}
            </Card>
          ) : null}
        </Section>
      </div>

      {isAdmin ? <AdminDigest edition={edition} polls={polls} members={members.list} proposals={proposals} now={now} /> : null}
    </div>
  )
}

export function DecisionPill({ status }: { status: string }) {
  switch (status) {
    case 'VOTING':
      return <Pill>En votación</Pill>
    case 'CONFIRMED':
      return <Pill tone="ok">Confirmado</Pill>
    case 'PENDING_RESERVATION':
      return <Pill tone="warn">Pendiente de reserva</Pill>
    case 'CLOSED':
      return <Pill tone="muted">Cerrado</Pill>
    default:
      return <Pill tone="muted">Sin definir</Pill>
  }
}

function AdminDigest({ edition, polls, members, proposals, now }: { edition: { title: string; slug: string }; polls: Poll[]; members: Member[]; proposals: Proposal[]; now: number }) {
  const toast = useToast()
  const activeCount = members.filter((m) => m.status === 'active' && m.participating).length
  const sizeOf = (p: Poll) => (p.electorateMode === 'ALL_ACTIVE' ? activeCount : p.electorate.length)
  const open = polls.filter((p) => isPollOpen(p, now)).sort((a, b) => (a.closeAt ?? Infinity) - (b.closeAt ?? Infinity))
  const expired = polls.filter((p) => p.state === 'OPEN' && !isPollOpen(p, now))
  const noEmail = members.filter((m) => m.status === 'draft')
  const pendingProposals = proposals.filter((p) => p.state === 'PENDING')
  const { rows: allResponses } = useCollectionCounts(open)
  function copy() {
    const lines = [`*${edition.title}* — pendientes`, '']
    for (const p of open) {
      const n = allResponses[p.id] ?? 0
      lines.push(`• ${p.title}: respondieron ${n} de ${sizeOf(p)} (${timeLeft(p.closeAt, now)})`)
    }
    if (open.length === 0) lines.push('• No hay consultas abiertas.')
    lines.push('', `Entrá acá: ${window.location.href.split('#')[0]}#/e/${edition.slug}`)
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => toast.ok('Copiado para WhatsApp'),
      () => toast.error('No se pudo copiar'),
    )
  }
  return (
    <Section title="Vista de Agus" aside={<Button size="sm" variant="line" onClick={copy}><Copy size={14} /> Copiar para WhatsApp</Button>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <p className="h3 mb-2">Próximos cierres</p>
          {open.length === 0 ? <p className="small muted">Nada abierto.</p> : null}
          {open.map((p) => {
            const part = participation(p, allResponses[p.id] ?? 0, sizeOf(p))
            return (
              <div key={p.id} className="row">
                <span className="small">{p.title}</span>
                <span className="tiny muted text-right">
                  {timeLeft(p.closeAt, now)}
                  <br />
                  {part.pct}% respondió
                </span>
              </div>
            )
          })}
          {expired.length ? <p className="tiny text-warn mt-2">{expired.length} consultas vencidas sin cerrar.</p> : null}
        </Card>
        <Card>
          <p className="h3 mb-2">Para revisar</p>
          <div className="row">
            <span className="small">Propuestas pendientes</span>
            <Link to="/admin/decisiones" className="font-bold">
              {pendingProposals.length}
            </Link>
          </div>
          <div className="row">
            <span className="small">Miembros sin mail</span>
            <Link to="/admin/miembros" className="font-bold">
              {noEmail.length}
            </Link>
          </div>
          <Link to="/admin" className="btn btn-line btn-sm mt-3">
            Ir a Administración
          </Link>
        </Card>
      </div>
    </Section>
  )
}

function useCollectionCounts(polls: Poll[]) {
  const { slug } = useSession()
  const paths = polls.map((p) => P.responses(slug, p.id))
  const key = JSON.stringify(paths)
  const { db } = useSession()
  const [rows, setRows] = useState<Record<string, number>>({})
  useEffect(() => {
    const list = JSON.parse(key) as string[]
    const unsubs = list.map((path, i) => db.subscribeCollection(path, (r) => setRows((cur) => ({ ...cur, [polls[i].id]: r.length }))))
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key])
  return { rows }
}

