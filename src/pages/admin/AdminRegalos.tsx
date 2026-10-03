// Regalos: presupuesto, inscripción, sorteo en el navegador de Agus, estados y acceso reservado al mapa.
import { useState } from 'react'
import { REGALO_MIN_PARTICIPANTES } from '../../content/config'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit, pushNews, setDecision } from '../../data/actions'
import { DataError } from '../../data/adapter'
import { useCollection, useDoc, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import type { GiftAssignment, GiftCampaign, GiftParticipant, GiftReceived } from '../../data/types'
import { formatArs, parseArs } from '../../domain/expenses'
import { drawSecretSanta, rosterHash, validateDraw } from '../../domain/gift'
import { fmtDateTime, localToMs, msToLocalParts } from '../../domain/format'
import { Button, Card, ConfirmDialog, Field, Input, Loading, Notice, Pill, Stat } from '../../ui/components'
import { useToast } from '../../ui/toast'

export function AdminRegalos() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { data: gift } = useDoc<GiftCampaign>(P.gift(slug))
  const { rows: participants } = useCollection<GiftParticipant>(P.giftParticipants(slug))
  const { rows: assignments } = useCollection<GiftAssignment>(P.giftAssignments(slug))
  const { rows: received } = useCollection<GiftReceived>(P.giftReceivedAll(slug))
  const [amount, setAmount] = useState('')
  const [tolerance, setTolerance] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [drawOpen, setDrawOpen] = useState(false)
  const [redrawOpen, setRedrawOpen] = useState(false)
  const [reservedOpen, setReservedOpen] = useState(false)
  const [showMap, setShowMap] = useState(false)

  if (!gift) return <Loading />
  const accepted = participants.filter((p) => p.accepted && p.acceptedBudgetVersion === gift.budgetVersion && members.byId[p.id]?.status === 'active')
  const viewed = assignments.filter((a) => a.viewedAt).length
  const ready = assignments.filter((a) => a.readyAt).length
  const delivered = assignments.filter((a) => a.deliveredAt).length
  const receivedCount = received.filter((r) => r.receivedAt).length

  async function run(key: string, fn: () => Promise<void>, ok = 'Guardado') {
    setBusy(key)
    try {
      await fn()
      toast.ok(ok)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function doDraw(reason: string) {
    const roster = gift!.roster.length ? gift!.roster : accepted.map((p) => p.id)
    if (roster.length < REGALO_MIN_PARTICIPANTES) throw new DataError('GIFT_MIN_PARTICIPANTS', `Hacen falta al menos ${REGALO_MIN_PARTICIPANTES} participantes.`)
    const expectedHash = await rosterHash(roster, gift!.budgetVersion)
    const { pairs } = drawSecretSanta(roster)
    const invalid = validateDraw(roster, pairs)
    if (invalid) throw new DataError('INVARIANT_VIOLATION', invalid)
    const version = gift!.drawVersion + 1
    await db.runTransaction(async (tx) => {
      const cur = await tx.get<GiftCampaign>(P.gift(slug))
      if (!cur) throw new DataError('NOT_FOUND')
      if (cur.drawVersion !== gift!.drawVersion) throw new DataError('STATE_CONFLICT', 'Hubo otro sorteo mientras tanto.')
      const curRoster = cur.roster.length ? cur.roster : roster
      if ((await rosterHash(curRoster, cur.budgetVersion)) !== expectedHash) throw new DataError('STATE_CONFLICT', 'Cambió el padrón. Revisá y volvé a intentar.')
      for (const p of pairs) {
        tx.set(P.giftAssignment(slug, p.giverId), { receiverId: p.receiverId, version, viewedAt: null, readyAt: null, deliveredAt: null, revealedAt: null, giverRevealedId: null } satisfies GiftAssignment)
      }
      tx.update(P.gift(slug), { state: 'DRAW_PUBLISHED', drawVersion: version, roster: curRoster, stats: { participants: curRoster.length, viewed: 0, ready: 0, delivered: 0 }, version: cur.version + 1, updatedAt: Date.now() })
    })
    await pushNews(db, slug, 'Tu amigo invisible ya está disponible. Entrá a verlo.')
    await logAudit(db, slug, memberId!, version > 1 ? 'gift.redraw' : 'gift.draw', `v${version}`, reason)
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Estado" value={<span className="text-base">{gift.state}</span>} />
        <Stat label="Anotados" value={gift.state === 'DRAFT' || gift.state === 'ENROLLMENT_OPEN' ? accepted.length : gift.roster.length} />
        <Stat label="Vieron" value={viewed} />
        <Stat label="Regalo listo" value={ready} />
        <Stat label="Entregados" value={`${delivered} / ${receivedCount} recibidos`} />
      </div>

      <Card>
        <p className="h3 mb-3">Presupuesto</p>
        <p className="small muted mb-3">Lo normal es confirmarlo desde la consulta de monto en Decisiones. Acá se puede fijar o ajustar antes del sorteo.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Monto (ARS)" id="g-amount">
            <Input id="g-amount" inputMode="decimal" placeholder={gift.amountCents ? String(gift.amountCents / 100) : ''} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Tolerancia %" id="g-tol">
            <Input id="g-tol" type="number" placeholder={String(gift.tolerancePct)} value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
          </Field>
          <Field label="Cierre de inscripción" id="g-close">
            <Input id="g-close" type="date" value={closeDate || msToLocalParts(gift.enrollCloseAt).date} onChange={(e) => setCloseDate(e.target.value)} />
          </Field>
        </div>
        <Button
          loading={busy === 'budget'}
          disabled={gift.state === 'DRAW_PUBLISHED' || gift.state === 'DELIVERY'}
          onClick={() =>
            void run('budget', async () => {
              const cents = amount ? parseArs(amount) : gift.amountCents
              const changed = cents !== gift.amountCents
              await db.updateDoc(P.gift(slug), {
                amountCents: cents,
                tolerancePct: tolerance ? Number(tolerance) : gift.tolerancePct,
                enrollCloseAt: localToMs(closeDate || msToLocalParts(gift.enrollCloseAt).date, '23:59'),
                budgetVersion: changed ? gift.budgetVersion + 1 : gift.budgetVersion,
                updatedAt: Date.now(),
              })
              if (cents) await setDecision(db, slug, 'regalo', { status: gift.state === 'DRAFT' ? 'CONFIRMED' : 'CONFIRMED', label: formatArs(cents), confirmedBy: memberId, confirmedAt: Date.now() })
              await logAudit(db, slug, memberId!, 'gift.budget', slug)
            }, 'Presupuesto guardado' + (amount && parseArs(amount) !== gift.amountCents ? '. Los anotados tienen que volver a aceptar.' : ''))
          }
        >
          Guardar presupuesto
        </Button>
      </Card>

      <Card>
        <p className="h3 mb-3">Inscripción y sorteo</p>
        <div className="flex gap-2 flex-wrap">
          {gift.state === 'DRAFT' ? (
            <Button
              variant="gold"
              loading={busy === 'open'}
              onClick={() => {
                if (!gift.amountCents) {
                  toast.error('Definí el monto antes de abrir la inscripción.')
                  return
                }
                void run('open', async () => {
                  await db.updateDoc(P.gift(slug), { state: 'ENROLLMENT_OPEN', updatedAt: Date.now() })
                  await pushNews(db, slug, `Amigo invisible: anotate. Monto ${formatArs(gift.amountCents!)}${gift.enrollCloseAt ? `, cierra ${fmtDateTime(gift.enrollCloseAt)}` : ''}.`)
                  await logAudit(db, slug, memberId!, 'gift.open', slug)
                }, 'Inscripción abierta')
              }}
            >
              Abrir inscripción
            </Button>
          ) : null}
          {gift.state === 'ENROLLMENT_OPEN' ? (
            <Button
              loading={busy === 'close'}
              onClick={() =>
                void run('close', async () => {
                  const roster = accepted.map((p) => p.id)
                  await db.updateDoc(P.gift(slug), { state: 'ENROLLMENT_CLOSED', roster, stats: { ...gift.stats, participants: roster.length }, updatedAt: Date.now() })
                  await logAudit(db, slug, memberId!, 'gift.close', `${roster.length} participantes`)
                }, 'Padrón congelado')
              }
            >
              Cerrar inscripción ({accepted.length})
            </Button>
          ) : null}
          {gift.state === 'ENROLLMENT_CLOSED' ? (
            <>
              <Button variant="gold" onClick={() => setDrawOpen(true)} disabled={gift.roster.length < REGALO_MIN_PARTICIPANTES}>
                Sortear ({gift.roster.length})
              </Button>
              <Button variant="line" onClick={() => void run('reopen', async () => db.updateDoc(P.gift(slug), { state: 'ENROLLMENT_OPEN', roster: [], updatedAt: Date.now() }), 'Inscripción reabierta')}>
                Reabrir inscripción
              </Button>
            </>
          ) : null}
          {gift.state === 'DRAW_PUBLISHED' ? (
            <>
              <Button onClick={() => void run('delivery', async () => db.updateDoc(P.gift(slug), { state: 'DELIVERY', updatedAt: Date.now() }), 'Modo entrega')}>
                Pasar a noche de regalos
              </Button>
              <Button variant="line" onClick={() => setRedrawOpen(true)}>
                Anular y volver a sortear
              </Button>
            </>
          ) : null}
          {gift.state === 'DELIVERY' ? (
            <Button variant="line" onClick={() => void run('archive', async () => db.updateDoc(P.gift(slug), { state: 'ARCHIVED', updatedAt: Date.now() }), 'Archivado')}>
              Archivar regalos
            </Button>
          ) : null}
        </div>
        {gift.state === 'ENROLLMENT_CLOSED' && gift.roster.length < REGALO_MIN_PARTICIPANTES ? <Notice tone="warn">Hacen falta al menos {REGALO_MIN_PARTICIPANTES} participantes para sortear.</Notice> : null}
        <p className="tiny muted mt-3">El sorteo corre en tu navegador con aleatoriedad criptográfica y se guarda una sola vez. No se muestra el mapa salvo con acceso reservado.</p>
      </Card>

      <Card>
        <p className="h3 mb-2">Participantes</p>
        {participants.length === 0 ? <p className="small muted">Nadie se anotó todavía.</p> : null}
        {participants.map((p) => (
          <div key={p.id} className="row">
            <span className="small">
              {members.aliasOf(p.id)} {!p.attending ? <span className="tiny muted">· no va, entrega {p.delegateId ? members.aliasOf(p.delegateId) : '?'}</span> : null}
            </span>
            <span className="flex gap-1">
              {p.accepted ? (p.acceptedBudgetVersion === gift.budgetVersion ? <Pill tone="ok">Anotado</Pill> : <Pill tone="warn">Debe re-aceptar monto</Pill>) : <Pill tone="muted">Se bajó</Pill>}
            </span>
          </div>
        ))}
      </Card>

      {gift.drawVersion > 0 ? (
        <Card>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="h3">Información reservada</p>
            {!showMap ? (
              <Button size="sm" variant="line" onClick={() => setReservedOpen(true)}>
                Ver mapa del sorteo
              </Button>
            ) : (
              <Button size="sm" variant="line" onClick={() => setShowMap(false)}>
                Ocultar
              </Button>
            )}
          </div>
          <p className="tiny muted">Sólo para resolver incidencias. Cada apertura queda registrada en Auditoría.</p>
          {showMap ? (
            <div className="mt-3">
              {assignments.map((a) => (
                <div key={a.id} className="row small">
                  <span>
                    {members.aliasOf(a.id)} → <b>{members.aliasOf(a.receiverId)}</b>
                  </span>
                  <span className="tiny muted">
                    {a.viewedAt ? 'vio' : 'no vio'} · {a.readyAt ? 'listo' : '—'} · {a.deliveredAt ? 'entregó' : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <ConfirmDialog
        open={drawOpen}
        onClose={() => setDrawOpen(false)}
        title="Sortear amigo invisible"
        text={`Se sortea entre ${gift.roster.length} participantes. Nadie se regala a sí mismo. Se publica una sola vez.`}
        confirmLabel="Sortear"
        loading={busy === 'draw'}
        onConfirm={async () => {
          await run('draw', () => doDraw(''), 'Sorteo publicado')
          setDrawOpen(false)
        }}
      />
      <ConfirmDialog
        open={redrawOpen}
        onClose={() => setRedrawOpen(false)}
        title="Anular y volver a sortear"
        text="Los destinatarios anteriores dejan de valer para todos. Avisá al grupo. Indicá el motivo."
        requireReason
        danger
        confirmLabel="Volver a sortear"
        loading={busy === 'draw'}
        onConfirm={async (reason) => {
          await run('draw', () => doDraw(reason), 'Nuevo sorteo publicado')
          setRedrawOpen(false)
        }}
      />
      <ConfirmDialog
        open={reservedOpen}
        onClose={() => setReservedOpen(false)}
        title="Acceso reservado"
        text="Vas a ver el mapa completo del sorteo. Indicá el motivo; queda registrado."
        requireReason
        confirmLabel="Ver"
        onConfirm={async (reason) => {
          await logAudit(db, slug, memberId!, 'reserved.read', 'gift.map', reason)
          setShowMap(true)
          setReservedOpen(false)
        }}
      />
    </div>
  )
}
