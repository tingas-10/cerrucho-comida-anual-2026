// Amigo invisible (administración): monto de referencia, participantes (todos los de la banda),
// sorteo con un botón y la lista completa de asignaciones para verificar. Rehacerlo pide motivo.
import { Gift } from 'lucide-react'
import { useMemo, useState } from 'react'
import { REGALO_MIN_PARTICIPANTES } from '../../content/config'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit, pushNews, setDecision } from '../../data/actions'
import { DataError } from '../../data/adapter'
import { useCollection, useDoc, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import type { GiftAssignment, GiftCampaign } from '../../data/types'
import { formatArs, parseArs } from '../../domain/expenses'
import { drawSecretSanta, validateDraw } from '../../domain/gift'
import { fmtDateTime } from '../../domain/format'
import { Button, Card, ConfirmDialog, Field, Input, Loading, MemberAvatar, Notice, Pill } from '../../ui/components'
import { useToast } from '../../ui/toast'

export function AdminRegalos() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { data: gift } = useDoc<GiftCampaign>(P.gift(slug))
  const { rows: assignments } = useCollection<GiftAssignment>(P.giftAssignments(slug))
  const [amount, setAmount] = useState('')
  const [tolerance, setTolerance] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [drawOpen, setDrawOpen] = useState(false)
  const [redrawOpen, setRedrawOpen] = useState(false)
  const [showMap, setShowMap] = useState(false)

  // Participan todos los de la banda que participan este año (con o sin usuario todavía).
  const participants = useMemo(() => members.list.filter((m) => m.status !== 'suspended' && m.participating).map((m) => m.id), [members.list])
  const withoutLogin = members.list.filter((m) => participants.includes(m.id) && m.status !== 'active')

  if (!gift) return <Loading />
  const drawn = gift.drawVersion > 0
  const current = assignments.filter((a) => a.version === gift.drawVersion)

  async function doDraw(reason: string) {
    const roster = [...participants]
    if (roster.length < REGALO_MIN_PARTICIPANTES) throw new DataError('GIFT_MIN_PARTICIPANTS', `Hacen falta al menos ${REGALO_MIN_PARTICIPANTES} participantes.`)
    const { pairs } = drawSecretSanta(roster)
    const invalid = validateDraw(roster, pairs)
    if (invalid) throw new DataError('INVARIANT_VIOLATION', invalid)
    const version = gift!.drawVersion + 1
    const stale = assignments.filter((a) => !roster.includes(a.id)).map((a) => a.id)
    await db.runTransaction(async (tx) => {
      const cur = await tx.get<GiftCampaign>(P.gift(slug))
      if (!cur) throw new DataError('NOT_FOUND')
      if (cur.drawVersion !== gift!.drawVersion) throw new DataError('STATE_CONFLICT', 'Ya se hizo otro sorteo mientras tanto. Recargá.')
      for (const p of pairs) {
        tx.set(P.giftAssignment(slug, p.giverId), { receiverId: p.receiverId, version, viewedAt: null, readyAt: null, deliveredAt: null, revealedAt: null, giverRevealedId: null } satisfies GiftAssignment)
      }
      for (const id of stale) tx.delete(P.giftAssignment(slug, id))
      tx.update(P.gift(slug), { state: 'DRAW_PUBLISHED', drawVersion: version, roster, drawnAt: Date.now(), stats: { participants: roster.length, viewed: 0, ready: 0, delivered: 0 }, version: cur.version + 1, updatedAt: Date.now() })
    })
    await pushNews(db, slug, version > 1 ? 'Se rehízo el sorteo del amigo invisible: fijate de nuevo a quién le regalás.' : 'Ya está el sorteo del amigo invisible. Entrá a ver a quién le regalás.')
    await logAudit(db, slug, memberId!, version > 1 ? 'gift.redraw' : 'gift.draw', `v${version} · ${roster.length} participantes`, reason)
  }

  async function run(key: string, fn: () => Promise<void>, ok: string) {
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

  return (
    <div className="grid gap-4">
      <Card>
        <p className="h3 mb-1">Monto de referencia</p>
        <p className="tiny muted mb-3">Opcional. Lo ve toda la banda en Amigo invisible.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto (ARS)" id="g-amount">
            <Input id="g-amount" inputMode="decimal" placeholder={gift.amountCents ? String(gift.amountCents / 100) : 'ej. 100000'} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Tolerancia %" id="g-tol">
            <Input id="g-tol" inputMode="numeric" placeholder={String(gift.tolerancePct)} value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
          </Field>
        </div>
        <Button
          variant="line"
          loading={busy === 'budget'}
          disabled={!amount && !tolerance}
          onClick={() =>
            void run(
              'budget',
              async () => {
                const cents = amount ? parseArs(amount) : gift.amountCents
                await db.updateDoc(P.gift(slug), { amountCents: cents, tolerancePct: tolerance ? Number(tolerance) : gift.tolerancePct, updatedAt: Date.now() })
                if (cents) await setDecision(db, slug, 'regalo', { status: 'CONFIRMED', label: formatArs(cents), confirmedBy: memberId, confirmedAt: Date.now() })
                setAmount('')
                setTolerance('')
              },
              'Monto guardado',
            )
          }
        >
          Guardar monto
        </Button>
        {gift.amountCents ? <p className="small mt-2">Actual: {formatArs(gift.amountCents)} (±{gift.tolerancePct}%)</p> : null}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <p className="h3">Sorteo</p>
          {drawn ? <Pill tone="ok">Sorteado{gift.drawnAt ? ` · ${fmtDateTime(gift.drawnAt)}` : ''}</Pill> : <Pill tone="muted">Sin sortear</Pill>}
        </div>
        <p className="small">
          Participan <b>{participants.length}</b>: todos los de la banda que participan este año, vayan o no a la comida.
        </p>
        {withoutLogin.length ? (
          <p className="tiny muted mt-1">
            {withoutLogin.length} todavía no tienen usuario ({withoutLogin.map((m) => m.alias).join(', ')}): entran al sorteo igual y ven su asignación cuando les crees el usuario.
          </p>
        ) : null}
        {!drawn ? (
          <Button variant="gold" className="mt-3" onClick={() => setDrawOpen(true)} disabled={participants.length < REGALO_MIN_PARTICIPANTES}>
            <Gift size={16} /> Sortear
          </Button>
        ) : (
          <div className="flex gap-2 flex-wrap mt-3">
            <Button variant="line" onClick={() => setShowMap((s) => !s)}>
              {showMap ? 'Ocultar asignaciones' : 'Ver todas las asignaciones'}
            </Button>
            <Button variant="line" onClick={() => setRedrawOpen(true)}>
              Rehacer sorteo
            </Button>
          </div>
        )}
        {participants.length < REGALO_MIN_PARTICIPANTES ? <Notice tone="warn">Hacen falta al menos {REGALO_MIN_PARTICIPANTES} participantes.</Notice> : null}
        {drawn && participants.length !== (gift.roster?.length ?? 0) ? (
          <Notice tone="warn">Desde el sorteo cambió la lista de participantes ({gift.roster?.length ?? 0} → {participants.length}). Las asignaciones no se tocaron solas: si hace falta, rehacé el sorteo.</Notice>
        ) : null}
        {showMap ? (
          <div className="mt-3">
            <p className="tiny muted mb-1">Sólo vos ves esto. Cada uno ve únicamente a quién le regala.</p>
            {current
              .slice()
              .sort((a, b) => members.aliasOf(a.id).localeCompare(members.aliasOf(b.id), 'es'))
              .map((a) => (
                <div key={a.id} className="row small">
                  <span className="flex items-center gap-2">
                    <MemberAvatar id={a.id} size={24} /> {members.aliasOf(a.id)}
                  </span>
                  <span className="flex items-center gap-2">
                    → <MemberAvatar id={a.receiverId} size={24} /> <b>{members.aliasOf(a.receiverId)}</b>
                  </span>
                </div>
              ))}
          </div>
        ) : null}
      </Card>

      <ConfirmDialog
        open={drawOpen}
        onClose={() => setDrawOpen(false)}
        title="Sortear amigo invisible"
        text={`Se sortea entre ${participants.length} personas. Cada uno le regala a otro distinto y nadie se regala a sí mismo. Queda guardado: recargar la página no lo repite.`}
        confirmLabel="Sortear"
        loading={busy === 'draw'}
        onConfirm={async () => {
          await run('draw', () => doDraw(''), 'Sorteo hecho')
          setDrawOpen(false)
        }}
      />
      <ConfirmDialog
        open={redrawOpen}
        onClose={() => setRedrawOpen(false)}
        title="Rehacer el sorteo"
        text="Todas las asignaciones anteriores dejan de valer y cada uno tiene que mirar de nuevo a quién le regala. Avisá en el grupo. Escribí el motivo."
        requireReason
        danger
        confirmLabel="Rehacer sorteo"
        loading={busy === 'draw'}
        onConfirm={async (reason) => {
          await run('draw', () => doDraw(reason), 'Sorteo rehecho')
          setRedrawOpen(false)
        }}
      />
    </div>
  )
}
