// Paso a paso del presidente: lo que hay que ir definiendo, en orden, con un solo botón por paso.
// Pensado para alguien que no se da maña con la tecnología: textos cortos y nada de configuración.
import { Check, ChevronRight, Gift, Trophy } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { REGALO_MIN_PARTICIPANTES } from '../../content/config'
import { VAO_ACTIVO } from '../../content/premios'
import { useSession } from '../../data/DataContext'
import { errorText, setDecision } from '../../data/actions'
import { openAwardsVoting } from '../../data/awards'
import { drawGift } from '../../data/gift'
import { useCollection, useDoc, useEdition, useMembers, useNow } from '../../data/hooks'
import { P } from '../../data/paths'
import type { Award, Edition, GiftCampaign } from '../../data/types'
import { formatArs, parseArs } from '../../domain/expenses'
import { fmtDateTime, fmtDayLong, localToMs, msToLocalParts } from '../../domain/format'
import { Button, Card, ConfirmDialog, Field, Input, Loading, Pill } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { awardPhase } from '../Premios'

const SEMANA = 7 * 24 * 3600000

function Step({ n, title, done, doneText, children }: { n: number; title: string; done: boolean; doneText?: string; children?: ReactNode }) {
  return (
    <Card className={done ? 'bg-ok-soft/30' : ''}>
      <div className="flex items-start gap-3">
        <span className={`shrink-0 grid place-items-center w-9 h-9 rounded-full font-extrabold ${done ? 'bg-ok text-white' : 'bg-soft text-accent'}`} aria-hidden>
          {done ? <Check size={18} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="h3">{title}</p>
            {done ? <Pill tone="ok">Listo</Pill> : <Pill tone="warn">Falta</Pill>}
          </div>
          {done && doneText ? <p className="small mt-1">{doneText}</p> : null}
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
      </div>
    </Card>
  )
}

function GoButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="btn btn-gold w-full sm:w-auto justify-center">
      {children} <ChevronRight size={16} />
    </Link>
  )
}

export function AdminGuia() {
  const { db, slug, memberId, isAgus } = useSession()
  const toast = useToast()
  const now = useNow()
  const members = useMembers()
  const { data: edition } = useEdition()
  const { data: gift } = useDoc<GiftCampaign>(P.gift(slug))
  const { rows: awards } = useCollection<Award>(P.awards(slug))
  const [amount, setAmount] = useState('')
  const [closeDate, setCloseDate] = useState(msToLocalParts(Date.now() + SEMANA).date)
  const [drawOpen, setDrawOpen] = useState(false)
  const [awardsOpen, setAwardsOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const participants = useMemo(() => members.list.filter((m) => m.status !== 'suspended' && m.participating), [members.list])
  const voters = members.active.filter((m) => m.participating)
  const list = awards.filter((a) => a.enabled && (VAO_ACTIVO || a.eligibility !== 'VAO'))
  const openable = list.filter((a) => a.state === 'DRAFT' && a.eligibility !== 'VAO')
  const voting = list.filter((a) => a.state === 'ROUND1_OPEN' || a.state === 'ROUND2_OPEN')

  if (!edition || !gift) return <Loading />
  const e = `/e/${slug}`
  const decided = (k: keyof Edition['decisions']) => edition.decisions[k]?.status === 'CONFIRMED'
  const label = (k: keyof Edition['decisions']) => edition.decisions[k]?.label ?? ''
  const drawn = gift.drawVersion > 0
  const awardsStarted = list.length > 0 && openable.length === 0
  const closeAt = voting.map((a) => (a.state === 'ROUND2_OPEN' ? a.round2 : a.round1)?.closeAt ?? 0).sort((x, y) => x - y)[0]
  const steps = [decided('fecha'), decided('lugar'), decided('menu'), drawn, awardsStarted]
  const left = steps.filter((x) => !x).length

  return (
    <div className="grid gap-3">
      <Card>
        <p className="h3">{left === 0 ? '¡Está todo encaminado!' : `Te ${left === 1 ? 'falta 1 paso' : `faltan ${left} pasos`}`}</p>
        <p className="small muted mt-1">Lo que hay que ir definiendo para la comida, en orden. Cada paso tiene un solo botón: tocalo y seguí lo que dice.</p>
      </Card>

      <Step n={1} title="Confirmar la fecha" done={decided('fecha')} doneText={edition.date.startsAt ? fmtDayLong(edition.date.startsAt) : label('fecha')}>
        {!decided('fecha') ? (
          <>
            <p className="small mb-3">Mirá qué día puede más gente y tocá <b>«Confirmar esta fecha»</b> en ese día.</p>
            <GoButton to={`${e}/fecha`}>Ir a la fecha</GoButton>
          </>
        ) : null}
      </Step>

      <Step n={2} title="Confirmar el lugar" done={decided('lugar')} doneText={label('lugar')}>
        {!decided('lugar') ? (
          <>
            <p className="small mb-3">Mirá los lugares que votaron y tocá <b>«Confirmar como definitivo»</b> en el elegido.</p>
            <GoButton to={`${e}/comida?ver=lugar`}>Ir a los lugares</GoButton>
          </>
        ) : null}
      </Step>

      <Step n={3} title="Confirmar la comida" done={decided('menu')} doneText={label('menu')}>
        {!decided('menu') ? (
          <>
            <p className="small mb-3">Igual que el lugar: tocá <b>«Confirmar como definitivo»</b> en la comida elegida.</p>
            <GoButton to={`${e}/comida?ver=menu`}>Ir a las comidas</GoButton>
          </>
        ) : null}
      </Step>

      <Step n={4} title="Sortear el amigo invisible" done={drawn} doneText={drawn ? `Sorteado${gift.drawnAt ? ` el ${fmtDateTime(gift.drawnAt)}` : ''}. Cada uno ya ve a quién le regala en «Amigo invisible».` : ''}>
        {!drawn ? (
          <>
            <p className="small mb-3">
              Entran los <b>{participants.length}</b> de la banda. Cada uno le regala a otro y nadie se regala a sí mismo. {isAgus ? '' : 'Vos tampoco vas a ver quién le regala a quién: así no se arruina la sorpresa.'}
            </p>
            <Field label="Monto sugerido del regalo (opcional)" id="pg-amount" hint={gift.amountCents ? `Ahora: ${formatArs(gift.amountCents)}` : 'Si lo dejás vacío, se puede poner después.'}>
              <Input id="pg-amount" inputMode="decimal" placeholder="ej. 30000" value={amount} onChange={(ev) => setAmount(ev.target.value)} />
            </Field>
            <Button variant="gold" className="w-full sm:w-auto" disabled={participants.length < REGALO_MIN_PARTICIPANTES} onClick={() => setDrawOpen(true)}>
              <Gift size={16} /> Sortear ahora
            </Button>
          </>
        ) : null}
      </Step>

      <Step
        n={5}
        title="Abrir la votación de premios"
        done={awardsStarted}
        doneText={voting.length ? (closeAt && closeAt > now ? `Abierta: se puede votar hasta el ${fmtDateTime(closeAt)}.` : 'La votación ya cerró. Agus cuenta los votos y los resultados se anuncian en la comida.') : 'La votación ya se hizo.'}
      >
        {!awardsStarted ? (
          <>
            <p className="small mb-3">
              Se abren las <b>{openable.length}</b> categorías y la banda puede votar desde ya. Nadie ve los votos: los resultados se anuncian en la comida.
            </p>
            <Field label="¿Hasta qué día se puede votar?" id="pg-close" hint="Cierra ese día a las 23:59.">
              <Input id="pg-close" type="date" value={closeDate} onChange={(ev) => setCloseDate(ev.target.value)} />
            </Field>
            <Button variant="gold" className="w-full sm:w-auto" disabled={openable.length === 0} onClick={() => setAwardsOpen(true)}>
              <Trophy size={16} /> Abrir la votación
            </Button>
          </>
        ) : voting.some((a) => awardPhase(a, now).phase === 'open') ? (
          <GoButton to={`${e}/premios`}>Ver los premios</GoButton>
        ) : null}
      </Step>

      <p className="tiny muted text-center mt-1">Si algo no sale, avisale a Agus. Lo demás (miembros, bebidas, tareas) está en las otras pestañas de Administración.</p>

      <ConfirmDialog
        open={drawOpen}
        onClose={() => setDrawOpen(false)}
        title="Sortear el amigo invisible"
        text={`Se sortea entre ${participants.length} personas y a cada uno le aparece a quién le regala. Se hace una sola vez.`}
        confirmLabel="Sortear"
        loading={busy}
        onConfirm={async () => {
          setBusy(true)
          try {
            const cents = amount.trim() ? parseArs(amount) : null
            if (cents) {
              await db.updateDoc(P.gift(slug), { amountCents: cents, updatedAt: Date.now() })
              await setDecision(db, slug, 'regalo', { status: 'CONFIRMED', label: formatArs(cents), confirmedBy: memberId, confirmedAt: Date.now() })
            }
            await drawGift(db, slug, memberId!, { ...gift, amountCents: cents ?? gift.amountCents }, participants.map((m) => m.id), '')
            toast.ok('¡Listo! Ya está el sorteo. Avisá en el grupo que entren a ver a quién le regalan.')
            setDrawOpen(false)
          } catch (err) {
            toast.error(errorText(err))
          } finally {
            setBusy(false)
          }
        }}
      />
      <ConfirmDialog
        open={awardsOpen}
        onClose={() => setAwardsOpen(false)}
        title="Abrir la votación de premios"
        text={`Se abren ${openable.length} categorías desde ahora hasta el ${closeDate ? fmtDayLong(localToMs(closeDate, '23:59') ?? null) : '…'} a las 23:59.`}
        confirmLabel="Abrir"
        loading={busy}
        onConfirm={async () => {
          setBusy(true)
          try {
            await openAwardsVoting(db, slug, memberId!, openable, voters.map((m) => m.id), () => voters.map((m) => m.id), Date.now(), localToMs(closeDate, '23:59'))
            toast.ok('¡Listo! La votación está abierta. Avisá en el grupo que entren a votar.')
            setAwardsOpen(false)
          } catch (err) {
            toast.error(errorText(err))
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}
