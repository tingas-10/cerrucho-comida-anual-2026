// Amigo invisible: presupuesto, inscripción, mi destinatario y estados de entrega.
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { REGALO_MIN_PARTICIPANTES } from '../content/config'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { useCollection, useDoc, useEdition, useMembers, useNow } from '../data/hooks'
import { P } from '../data/paths'
import type { GiftAssignment, GiftCampaign, GiftParticipant, GiftReceived, Poll } from '../data/types'
import { formatArs } from '../domain/expenses'
import { fmtDateTime, timeLeft } from '../domain/format'
import { Avatar, Button, Card, Field, Loading, Notice, PageHeader, Pill, Section, Textarea } from '../ui/components'
import { PollCard } from '../ui/PollCard'
import { useToast } from '../ui/toast'

export function AmigoInvisible() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const now = useNow()
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  const { data: gift } = useDoc<GiftCampaign>(P.gift(slug))
  const { rows: polls } = useCollection<Poll>(P.polls(slug), [{ field: 'kind', op: '==', value: 'gift_amount' }])
  const mine = useDoc<GiftParticipant>(memberId ? P.giftParticipant(slug, memberId) : null)
  const assignment = useDoc<GiftAssignment>(memberId ? P.giftAssignment(slug, memberId) : null)
  const received = useDoc<GiftReceived>(memberId ? P.giftReceived(slug, memberId) : null)
  const receiverWishes = useDoc<GiftParticipant>(assignment.data ? P.giftParticipant(slug, assignment.data.receiverId) : null)
  const [attending, setAttending] = useState(true)
  const [delegate, setDelegate] = useState('')
  const [wishes, setWishes] = useState('')
  const [avoid, setAvoid] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!mine.data) return
    setAttending(mine.data.attending)
    setDelegate(mine.data.delegateId ?? '')
    setWishes(mine.data.wishes ?? '')
    setAvoid(mine.data.avoid ?? '')
  }, [mine.data])

  if (loading || !edition || !gift) return <Loading />
  const visiblePolls = polls.filter((p) => p.state !== 'DRAFT' && p.state !== 'VOID')
  const enrollOpen = gift.state === 'ENROLLMENT_OPEN' && (!gift.enrollCloseAt || now < gift.enrollCloseAt)
  const amount = gift.amountCents
  const low = amount ? Math.round(amount * (1 - gift.tolerancePct / 100)) : null
  const high = amount ? Math.round(amount * (1 + gift.tolerancePct / 100)) : null

  async function enroll(accept: boolean) {
    if (!memberId) return
    if (accept && !attending && !delegate) {
      toast.error('Si no venís, elegí quién entrega tu regalo.')
      return
    }
    setBusy(true)
    try {
      const p: GiftParticipant = { accepted: accept, acceptedBudgetVersion: gift!.budgetVersion, attending, delegateId: attending ? null : delegate || null, wishes: wishes.trim(), avoid: avoid.trim(), updatedAt: Date.now() }
      await db.setDoc(P.giftParticipant(slug, memberId), p)
      toast.ok(accept ? '¡Estás adentro!' : 'Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  async function saveWishes() {
    if (!memberId || !mine.data) return
    setBusy(true)
    try {
      await db.updateDoc(P.giftParticipant(slug, memberId), { wishes: wishes.trim(), avoid: avoid.trim(), updatedAt: Date.now() })
      toast.ok('Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  async function mark(field: 'viewedAt' | 'readyAt' | 'deliveredAt') {
    if (!memberId || !assignment.data) return
    try {
      await db.updateDoc(P.giftAssignment(slug, memberId), { [field]: Date.now() })
    } catch (e) {
      toast.error(errorText(e))
    }
  }
  async function revealMe() {
    if (!memberId || !assignment.data) return
    try {
      await db.updateDoc(P.giftAssignment(slug, memberId), { revealedAt: Date.now(), giverRevealedId: memberId })
      await db.setDoc<Partial<GiftReceived>>(P.giftReceived(slug, assignment.data.receiverId), { giverRevealedId: memberId }, { merge: true })
      toast.ok('Tu destinatario ya puede ver que fuiste vos.')
    } catch (e) {
      toast.error(errorText(e))
    }
  }
  async function markReceived() {
    if (!memberId) return
    try {
      await db.setDoc<GiftReceived>(P.giftReceived(slug, memberId), { receivedAt: Date.now() }, { merge: true })
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  const stateLabel: Record<GiftCampaign['state'], string> = {
    DRAFT: 'Definiendo presupuesto',
    ENROLLMENT_OPEN: 'Inscripción abierta',
    ENROLLMENT_CLOSED: 'Inscripción cerrada, falta sortear',
    DRAW_PUBLISHED: 'Sorteado',
    DELIVERY: 'Noche de regalos',
    ARCHIVED: 'Archivado',
  }

  return (
    <div>
      <PageHeader eyebrow="Esta edición" title="Amigo invisible" intro="Primero elegimos el monto. Después cada uno se anota y, al cerrar, se sortea una sola vez. Vos ves sólo a quién le regalás." actions={<Pill>{stateLabel[gift.state]}</Pill>} />

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="eyebrow">Monto de referencia</p>
            <p className="h2 mt-1">{amount ? formatArs(amount) : 'Sin definir'}</p>
            {amount && low && high ? <p className="small muted">Entre {formatArs(low)} y {formatArs(high)} está bien (±{gift.tolerancePct}%).</p> : null}
          </div>
          {gift.enrollCloseAt && gift.state === 'ENROLLMENT_OPEN' ? <Pill tone={enrollOpen ? 'accent' : 'muted'}>{enrollOpen ? `Inscripción ${timeLeft(gift.enrollCloseAt, now)}` : 'Inscripción cerrada'}</Pill> : null}
        </div>
      </Card>

      {visiblePolls.length ? (
        <Section title="Presupuesto" className="mt-2">
          {visiblePolls.map((p) => (
            <PollCard key={p.id} poll={p} aliasOf={members.aliasOf} />
          ))}
          <p className="tiny muted mt-2">Si no querés participar del regalo, simplemente no te anotes: no es un voto de monto.</p>
        </Section>
      ) : null}

      {gift.state === 'ENROLLMENT_OPEN' || gift.state === 'ENROLLMENT_CLOSED' ? (
        <Section title="Inscripción">
          <Card>
            {mine.data?.accepted ? <Notice tone="ok">Estás anotado. {gift.enrollCloseAt ? `Cierra ${fmtDateTime(gift.enrollCloseAt)}.` : ''}</Notice> : <p className="small muted">Me sumo significa aceptar el monto y la fecha límite. Confirmar la comida anual no te anota: esto es aparte.</p>}
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <Field label="¿Vas a estar en la comida anual?" id="attending">
                <select id="attending" className="input" value={attending ? 'si' : 'no'} disabled={!enrollOpen} onChange={(e) => setAttending(e.target.value === 'si')}>
                  <option value="si">Sí, voy</option>
                  <option value="no">No, pero participo igual</option>
                </select>
              </Field>
              {!attending ? (
                <Field label="Quién entrega tu regalo" id="delegate">
                  <select id="delegate" className="input" value={delegate} disabled={!enrollOpen} onChange={(e) => setDelegate(e.target.value)}>
                    <option value="">Elegí</option>
                    {members.active.filter((m) => m.id !== memberId).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.alias}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
            <Field label="Lista de deseos (opcional)" id="wishes" hint="La ve sólo quien te regala.">
              <Textarea id="wishes" value={wishes} onChange={(e) => setWishes(e.target.value)} maxLength={300} />
            </Field>
            <Field label="No me regales (opcional)" id="avoid">
              <Textarea id="avoid" value={avoid} onChange={(e) => setAvoid(e.target.value)} maxLength={200} />
            </Field>
            <div className="flex gap-2 flex-wrap">
              {enrollOpen ? (
                <>
                  <Button variant="gold" onClick={() => void enroll(true)} loading={busy} disabled={!amount}>
                    {mine.data?.accepted ? 'Guardar cambios' : 'Me sumo'}
                  </Button>
                  {mine.data?.accepted ? (
                    <Button variant="line" onClick={() => void enroll(false)} loading={busy}>
                      Me bajo
                    </Button>
                  ) : null}
                </>
              ) : mine.data?.accepted ? (
                <Button variant="line" onClick={() => void saveWishes()} loading={busy}>
                  Guardar lista
                </Button>
              ) : null}
            </div>
            {!amount && enrollOpen ? <p className="tiny text-warn mt-2">Falta confirmar el monto para inscribirse.</p> : null}
            <p className="tiny muted mt-3">
              Anotados: {gift.stats.participants}. Hacen falta al menos {REGALO_MIN_PARTICIPANTES} para sortear.
            </p>
          </Card>
        </Section>
      ) : null}

      {(gift.state === 'DRAW_PUBLISHED' || gift.state === 'DELIVERY') && mine.data?.accepted ? (
        <Section title="Tu amigo invisible">
          {assignment.data ? (
            <Card>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="small muted">Te tocó regalarle a</p>
                <Button size="sm" variant="line" onClick={() => { setRevealed((r) => !r); if (!assignment.data?.viewedAt) void mark('viewedAt') }}>
                  {revealed ? <EyeOff size={16} /> : <Eye size={16} />} {revealed ? 'Ocultar' : 'Ver'}
                </Button>
              </div>
              {revealed ? (
                <div className="mt-3 pop-in">
                  <p className="flex items-center gap-3 text-2xl font-extrabold">
                    <Avatar id={assignment.data.receiverId} alias={members.aliasOf(assignment.data.receiverId)} size={44} color={members.byId[assignment.data.receiverId]?.avatarColor} />
                    {members.aliasOf(assignment.data.receiverId)}
                  </p>
                  {receiverWishes.data?.wishes ? <p className="small mt-3"><b>Le gustaría:</b> {receiverWishes.data.wishes}</p> : null}
                  {receiverWishes.data?.avoid ? <p className="small mt-1"><b>No le regales:</b> {receiverWishes.data.avoid}</p> : null}
                  {!receiverWishes.data?.wishes && !receiverWishes.data?.avoid ? <p className="small muted mt-3">No dejó pistas. Vas a tener que conocerlo.</p> : null}
                </div>
              ) : (
                <p className="mt-3 h2 tracking-widest">••••••</p>
              )}
              <div className="flex gap-2 flex-wrap mt-4">
                <Button size="sm" variant={assignment.data.readyAt ? 'line' : 'solid'} disabled={!!assignment.data.readyAt} onClick={() => void mark('readyAt')}>
                  {assignment.data.readyAt ? 'Regalo listo ✓' : 'Regalo listo'}
                </Button>
                <Button size="sm" variant={assignment.data.deliveredAt ? 'line' : 'solid'} disabled={!!assignment.data.deliveredAt} onClick={() => void mark('deliveredAt')}>
                  {assignment.data.deliveredAt ? 'Entregado ✓' : 'Entregado'}
                </Button>
                {assignment.data.deliveredAt && !assignment.data.revealedAt ? (
                  <Button size="sm" variant="gold" onClick={() => void revealMe()}>
                    Revelarle que fui yo
                  </Button>
                ) : null}
              </div>
              <p className="tiny muted mt-3">Nadie ve quién te regala a vos. Una baja de asistencia no cambia el sorteo: coordiná la entrega.</p>
            </Card>
          ) : (
            <Card>
              <Loading text="Buscando tu asignación…" />
            </Card>
          )}
          <Card className="mt-3">
            <p className="h3">Tu regalo</p>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <Button size="sm" variant={received.data?.receivedAt ? 'line' : 'solid'} disabled={!!received.data?.receivedAt} onClick={() => void markReceived()}>
                {received.data?.receivedAt ? 'Recibido ✓' : 'Lo recibí'}
              </Button>
              {received.data?.giverRevealedId ? <span className="small">Te lo regaló <b>{members.aliasOf(received.data.giverRevealedId)}</b>.</span> : <span className="tiny muted">Quien te regala puede revelarse después de entregarlo.</span>}
            </div>
          </Card>
        </Section>
      ) : null}

      {gift.state === 'DRAW_PUBLISHED' && !mine.data?.accepted ? <Notice>No participás del regalo este año.</Notice> : null}
      {gift.state === 'DRAFT' && visiblePolls.length === 0 ? <Notice>Todavía no se definió el monto. Agus abre la consulta cuando corresponda.</Notice> : null}
    </div>
  )
}
