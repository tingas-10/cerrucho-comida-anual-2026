// Panel del presidente: todo lo que decide o lanza, en una sola página y sin ir a ningún otro lado.
// Fecha, lugar, comida y salida se confirman acá mismo mirando lo votado; el amigo invisible y los premios
// se lanzan con un botón. Sin orden: cada cosa cuando quiera. Pensado para alguien que no se da maña con la
// tecnología. No muestra quién le regala a quién ni cómo va la votación (eso es sólo de Agus).
import { CalendarDays, Check, Gift, MapPin, PartyPopper, ThumbsDown, ThumbsUp, Trophy, UtensilsCrossed } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { REGALO_MIN_PARTICIPANTES } from '../content/config'
import { VAO_ACTIVO } from '../content/premios'
import { useSession } from '../data/DataContext'
import { errorText, setDecision } from '../data/actions'
import { openAwardsVoting } from '../data/awards'
import { clearDecision, confirmDate, confirmProposal } from '../data/decisions'
import { drawGift } from '../data/gift'
import { electorateOf, useCollection, useDoc, useEdition, useMembers, useNow } from '../data/hooks'
import { P } from '../data/paths'
import type { Award, Edition, GiftCampaign, Poll, PollOption, PollResponse, Proposal, ProposalType } from '../data/types'
import { formatArs, parseArs } from '../domain/expenses'
import { fmtDateTime, fmtDayLong, fmtTime, localToMs, msToLocalParts } from '../domain/format'
import { summarizeDates } from '../domain/polls'
import { Button, Card, ConfirmDialog, Field, Input, Loading, Notice, PageHeader, Pill } from '../ui/components'
import { useToast } from '../ui/toast'

const SEMANA = 7 * 24 * 3600000

/** Una caja por tema: ícono, título, estado y lo que se puede hacer. */
function Box({ icon, title, done, doneLabel = 'Confirmado', children }: { icon: ReactNode; title: string; done: boolean; doneLabel?: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="h3 flex items-center gap-2">
          <span className="text-accent shrink-0">{icon}</span> {title}
        </p>
        {done ? <Pill tone="ok">{doneLabel}</Pill> : <Pill tone="warn">Falta</Pill>}
      </div>
      {children}
    </Card>
  )
}

/** Lo ya decidido, bien grande. */
function Chosen({ text, by }: { text: string; by?: string }) {
  return (
    <div className="rounded-xl bg-ok-soft/40 border border-line p-3 mb-3">
      <p className="font-bold flex items-center gap-2">
        <Check size={18} className="text-ok shrink-0" /> {text}
      </p>
      {by ? <p className="tiny muted mt-0.5">{by}</p> : null}
    </div>
  )
}

/** Hace la acción, avisa si salió bien o qué falló. */
function useRun() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function run(fn: () => Promise<void>, ok: string): Promise<boolean> {
    setBusy(true)
    try {
      await fn()
      toast.ok(ok)
      return true
    } catch (e) {
      toast.error(errorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

export function Presidente() {
  const { canDecide, isMember } = useSession()
  const { data: edition, loading } = useEdition()
  if (loading || !edition) return <Loading />
  if (!isMember || !canDecide) return <Notice tone="warn">Esta página es para el presidente.</Notice>
  return (
    <div>
      <PageHeader eyebrow={edition.title} title="Panel del presidente" intro="Desde acá confirmás y lanzás todo, cuando quieras y en el orden que quieras. Cada cosa tiene su botón." />
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <FechaBox edition={edition} />
        <ProposalBox edition={edition} type="venue" decisionKey="lugar" title="Lugar" icon={<MapPin size={20} />} />
        <ProposalBox edition={edition} type="food" decisionKey="menu" title="Comida" icon={<UtensilsCrossed size={20} />} />
        <ProposalBox edition={edition} type="afterparty" decisionKey="salida" title="Salida (a dónde seguimos)" icon={<PartyPopper size={20} />} />
        <GiftBox />
        <AwardsBox />
      </div>
      <p className="tiny muted text-center mt-4">Cada vez que confirmás o lanzás algo, la banda lo ve en la web. Si algo no sale, avisale a Agus.</p>
    </div>
  )
}

function FechaBox({ edition }: { edition: Edition }) {
  const { db, slug, memberId } = useSession()
  const members = useMembers()
  const now = useNow()
  const { rows: polls } = useCollection<Poll>(P.polls(slug), [{ field: 'kind', op: '==', value: 'dates' }])
  const poll = polls.filter((p) => p.state === 'OPEN' || p.state === 'CLOSED').sort((a, b) => b.createdAt - a.createdAt)[0]
  const { rows: responses } = useCollection<PollResponse>(poll ? P.responses(slug, poll.id) : null)
  const [changing, setChanging] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [target, setTarget] = useState<PollOption | null>(null)
  const { busy, run } = useRun()
  const done = edition.decisions.fecha?.status === 'CONFIRMED' && !!edition.date.startsAt

  const rows = useMemo(() => {
    if (!poll) return []
    const sums = summarizeDates(poll, responses, electorateOf(poll, members))
    return poll.options
      .filter((o) => o.startsAt && o.startsAt > now)
      .map((o) => ({ o, s: sums.find((x) => x.optionId === o.id)! }))
      .sort((a, b) => b.s.yes.length - a.s.yes.length || b.s.maybe.length - a.s.maybe.length || (a.o.startsAt ?? 0) - (b.o.startsAt ?? 0))
  }, [poll, responses, members, now])
  const shown = showAll ? rows : rows.slice(0, 5)

  return (
    <Box icon={<CalendarDays size={20} />} title="Fecha" done={done}>
      {done ? <Chosen text={`${fmtDayLong(edition.date.startsAt)} · ${fmtTime(edition.date.startsAt!)} h`} by={edition.date.confirmedBy ? `Confirmó ${members.aliasOf(edition.date.confirmedBy)}` : undefined} /> : null}
      {done && !changing ? (
        <Button variant="line" size="sm" onClick={() => setChanging(true)}>
          Cambiar la fecha
        </Button>
      ) : !poll || rows.length === 0 ? (
        <p className="small muted">Todavía no hay fechas para elegir. Las carga Agus.</p>
      ) : (
        <>
          <p className="small mb-2">Las que más pueden van primero. Tocá «Confirmar» en la que elijas.</p>
          {shown.map(({ o, s }, i) => {
            const isIt = done && edition.date.startsAt === o.startsAt
            return (
              <div key={o.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-line">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {fmtDayLong(o.startsAt ?? null)} {i === 0 && s.yes.length > 0 ? <Pill tone="accent" className="ml-1">La que más pueden</Pill> : null}
                  </p>
                  <p className="tiny muted">
                    {s.yes.length} pueden · {s.maybe.length} capaz · {s.no.length} no pueden{s.pending.length ? ` · ${s.pending.length} sin responder` : ''}
                  </p>
                </div>
                {isIt ? (
                  <Pill tone="ok">Es esta</Pill>
                ) : (
                  <Button size="sm" variant="gold" className="shrink-0" onClick={() => setTarget(o)}>
                    Confirmar
                  </Button>
                )}
              </div>
            )
          })}
          {rows.length > 5 ? (
            <button type="button" className="text-link small mt-1" onClick={() => setShowAll((x) => !x)}>
              {showAll ? 'Ver menos' : `Ver las ${rows.length} fechas`}
            </button>
          ) : null}
        </>
      )}
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        title="Confirmar la fecha"
        text={
          target
            ? `La comida queda el ${fmtDayLong(target.startsAt ?? null)}.${done ? ' Como cambia la fecha, cada uno va a tener que volver a confirmar si va.' : ' Toda la banda lo ve y cada uno marca si va.'}`
            : ''
        }
        confirmLabel="Confirmar"
        loading={busy}
        onConfirm={async () => {
          if (await run(() => confirmDate(db, slug, edition, poll!.id, target!, memberId!), '¡Fecha confirmada! Ya la ve toda la banda.')) {
            setTarget(null)
            setChanging(false)
          }
        }}
      />
    </Box>
  )
}

function votesOf(p: Proposal) {
  const v = Object.values(p.votes ?? {})
  return { up: v.filter((x) => x === 'up').length, down: v.filter((x) => x === 'down').length }
}

function ProposalBox({ edition, type, decisionKey, title, icon }: { edition: Edition; type: ProposalType; decisionKey: 'lugar' | 'menu' | 'salida'; title: string; icon: ReactNode }) {
  const { db, slug, memberId } = useSession()
  const members = useMembers()
  const { rows } = useCollection<Proposal>(P.proposals(slug))
  const [target, setTarget] = useState<Proposal | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const { busy, run } = useRun()
  const decision = edition.decisions[decisionKey]
  const done = decision?.status === 'CONFIRMED'
  const list = rows
    .filter((p) => p.type === type && p.state !== 'WITHDRAWN' && p.state !== 'REJECTED')
    .sort((a, b) => votesOf(b).up - votesOf(b).down - (votesOf(a).up - votesOf(a).down) || votesOf(b).up - votesOf(a).up || a.createdAt - b.createdAt)
  const what = title.split(' ')[0].toLowerCase()

  return (
    <Box icon={icon} title={title} done={done}>
      {done ? <Chosen text={decision?.label ?? ''} by={decision?.confirmedBy ? `Confirmó ${members.aliasOf(decision.confirmedBy)}` : undefined} /> : null}
      {list.length === 0 ? (
        <p className="small muted">Todavía nadie propuso opciones. La banda las propone y vota en la web.</p>
      ) : (
        <>
          <p className="small mb-2">{done ? 'Si querés cambiarlo, confirmá otra opción.' : 'Las más votadas van primero. Tocá «Confirmar» en la que elijas.'}</p>
          {list.map((p) => {
            const v = votesOf(p)
            const isIt = done && decision?.proposalId === p.id
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-line">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{p.label}</p>
                  <p className="tiny muted flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp size={13} /> {v.up}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ThumbsDown size={13} /> {v.down}
                    </span>
                  </p>
                </div>
                {isIt ? (
                  <Pill tone="ok">Es esta</Pill>
                ) : (
                  <Button size="sm" variant={done ? 'line' : 'gold'} className="shrink-0" onClick={() => setTarget(p)}>
                    Confirmar
                  </Button>
                )}
              </div>
            )
          })}
          {done ? (
            <button type="button" className="text-link small mt-1" onClick={() => setClearOpen(true)}>
              Dejarlo sin definir
            </button>
          ) : null}
        </>
      )}
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Confirmar ${what}`}
        text={target ? `Queda «${target.label}» como definitivo. Toda la banda lo ve.` : ''}
        confirmLabel="Confirmar"
        loading={busy}
        onConfirm={async () => {
          if (await run(() => confirmProposal(db, slug, target!, memberId!), '¡Confirmado! Ya lo ve toda la banda.')) setTarget(null)
        }}
      />
      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title={`Dejar ${what} sin definir`}
        text="Vuelve a quedar «A definir» y lo podés confirmar de nuevo cuando quieras."
        confirmLabel="Dejar sin definir"
        loading={busy}
        onConfirm={async () => {
          if (await run(() => clearDecision(db, slug, decisionKey, memberId!), 'Listo, quedó sin definir.')) setClearOpen(false)
        }}
      />
    </Box>
  )
}

function GiftBox() {
  const { db, slug, memberId, isAgus } = useSession()
  const members = useMembers()
  const { data: gift } = useDoc<GiftCampaign>(P.gift(slug))
  const [amount, setAmount] = useState('')
  const [open, setOpen] = useState(false)
  const { busy, run } = useRun()
  const participants = members.list.filter((m) => m.status !== 'suspended' && m.participating)
  if (!gift) return null
  const drawn = gift.drawVersion > 0

  return (
    <Box icon={<Gift size={20} />} title="Amigo invisible" done={drawn} doneLabel="Sorteado">
      {drawn ? (
        <>
          <Chosen text={`Ya está sorteado${gift.drawnAt ? ` (${fmtDateTime(gift.drawnAt)})` : ''}`} by="Cada uno ve a quién le regala entrando a «Amigo invisible»." />
          {gift.amountCents ? <p className="small">Monto sugerido: {formatArs(gift.amountCents)}</p> : null}
        </>
      ) : (
        <>
          <p className="small mb-3">
            Entran los <b>{participants.length}</b> de la banda. Cada uno le regala a otro y nadie se regala a sí mismo.{isAgus ? '' : ' Vos tampoco vas a ver quién le regala a quién, así no se arruina la sorpresa.'}
          </p>
          <Field label="Monto sugerido del regalo (si querés)" id="pp-amount" hint="Se puede dejar vacío.">
            <Input id="pp-amount" inputMode="decimal" placeholder="ej. 30000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Button variant="gold" className="w-full sm:w-auto" disabled={participants.length < REGALO_MIN_PARTICIPANTES} onClick={() => setOpen(true)}>
            <Gift size={16} /> Sortear ahora
          </Button>
        </>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Sortear el amigo invisible"
        text={`Se sortea entre ${participants.length} personas y a cada uno le aparece a quién le regala.${amount.trim() ? ` Monto sugerido: ${formatArs(parseArs(amount) ?? 0)}.` : ''}`}
        confirmLabel="Sortear"
        loading={busy}
        onConfirm={async () => {
          const ok = await run(async () => {
            const cents = amount.trim() ? parseArs(amount) : null
            if (cents) {
              await db.updateDoc(P.gift(slug), { amountCents: cents, updatedAt: Date.now() })
              await setDecision(db, slug, 'regalo', { status: 'CONFIRMED', label: formatArs(cents), confirmedBy: memberId, confirmedAt: Date.now() })
            }
            await drawGift(db, slug, memberId!, { ...gift, amountCents: cents ?? gift.amountCents }, participants.map((m) => m.id), '')
          }, '¡Listo, ya está el sorteo! Avisá en el grupo que entren a ver a quién le regalan.')
          if (ok) setOpen(false)
        }}
      />
    </Box>
  )
}

function AwardsBox() {
  const { db, slug, memberId } = useSession()
  const members = useMembers()
  const now = useNow()
  const { rows: awards } = useCollection<Award>(P.awards(slug))
  const [closeDate, setCloseDate] = useState(msToLocalParts(Date.now() + SEMANA).date)
  const [open, setOpen] = useState(false)
  const { busy, run } = useRun()
  const voters = members.active.filter((m) => m.participating).map((m) => m.id)
  const list = awards.filter((a) => a.enabled && (VAO_ACTIVO || a.eligibility !== 'VAO'))
  const openable = list.filter((a) => a.state === 'DRAFT' && a.eligibility !== 'VAO')
  const voting = list.filter((a) => a.state === 'ROUND1_OPEN' || a.state === 'ROUND2_OPEN')
  const closeAt = voting.map((a) => (a.state === 'ROUND2_OPEN' ? a.round2 : a.round1)?.closeAt ?? 0).sort((x, y) => x - y)[0]
  const started = list.length > 0 && openable.length === 0

  return (
    <Box icon={<Trophy size={20} />} title="Premios" done={started} doneLabel={voting.length && closeAt > now ? 'Votación abierta' : 'Lanzado'}>
      {started ? (
        <Chosen
          text={voting.length && closeAt > now ? `Votación abierta hasta el ${fmtDateTime(closeAt)}` : 'La votación ya se hizo'}
          by="Nadie ve los votos: los resultados se anuncian en la comida."
        />
      ) : (
        <>
          <p className="small mb-3">
            Se abren las <b>{openable.length}</b> categorías y la banda puede votar desde ya. Nadie ve los votos: los resultados se anuncian en la comida.
          </p>
          <Field label="¿Hasta qué día se puede votar?" id="pp-close" hint="Cierra ese día a las 23:59.">
            <Input id="pp-close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </Field>
          <Button variant="gold" className="w-full sm:w-auto" disabled={openable.length === 0} onClick={() => setOpen(true)}>
            <Trophy size={16} /> Abrir la votación
          </Button>
        </>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Abrir la votación de premios"
        text={`Se abren ${openable.length} categorías desde ahora hasta el ${closeDate ? fmtDayLong(localToMs(closeDate, '23:59') ?? null) : '…'} a las 23:59.`}
        confirmLabel="Abrir"
        loading={busy}
        onConfirm={async () => {
          const ok = await run(
            async () => void (await openAwardsVoting(db, slug, memberId!, openable, voters, () => voters, Date.now(), localToMs(closeDate, '23:59'))),
            '¡Listo, la votación está abierta! Avisá en el grupo que entren a votar.',
          )
          if (ok) setOpen(false)
        }}
      />
    </Box>
  )
}
