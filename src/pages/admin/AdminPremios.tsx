// Premios: categorías, apertura y cierre de rondas, sellado sin mirar, ballotage, anulación y acceso reservado.
import { useMemo, useState } from 'react'
import { BALLOTAGE_HORAS } from '../../content/config'
import { NOBODY, VAO_ACTIVO } from '../../content/premios'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit, pushNews, setDecision } from '../../data/actions'
import { DataError } from '../../data/adapter'
import { useCollection, useEdition, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import type { Award, AwardResult, Ballot, SealedResult } from '../../data/types'
import { countBallots, resolveRound1, resolveRound2 } from '../../domain/awards'
import { fmtDateTime, hoursFromNow, localToMs, timeLeft } from '../../domain/format'
import { Button, Card, ConfirmDialog, Field, Input, Loading, Modal, Notice, Pill, Textarea } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { awardTitle } from '../Premios'

export function AdminPremios() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const { data: edition } = useEdition()
  const members = useMembers()
  const { rows: awards } = useCollection<Award>(P.awards(slug))
  const list = useMemo(() => awards.filter((a) => VAO_ACTIVO || a.eligibility !== 'VAO').sort((a, b) => a.order - b.order), [awards])
  const [busy, setBusy] = useState<string | null>(null)
  const [closeDate, setCloseDate] = useState('')
  const [closeTime, setCloseTime] = useState('23:59')
  const [editing, setEditing] = useState<Award | null>(null)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [voidTarget, setVoidTarget] = useState<Award | null>(null)
  const [manualTarget, setManualTarget] = useState<Award | null>(null)
  const [manualWinner, setManualWinner] = useState('')
  const [reservedTarget, setReservedTarget] = useState<Award | null>(null)
  const [revealTarget, setRevealTarget] = useState<Award | null>(null)
  const [reserved, setReserved] = useState<Record<string, SealedResult>>({})
  const [newLabel, setNewLabel] = useState('')
  const [ballotCounts, setBallotCounts] = useState<Record<string, number>>({})

  if (!edition) return <Loading />
  const participants = members.active.filter((m) => m.participating)
  const vao = participants.filter((m) => m.vao)
  const drafts = list.filter((a) => a.enabled && a.state === 'DRAFT')
  const openable = drafts.filter((a) => a.eligibility !== 'VAO' || (edition.vaoRosterConfirmed && vao.length > 0))
  const closeAtMs = localToMs(closeDate, closeTime)

  async function run(key: string, fn: () => Promise<void>, ok = 'Listo') {
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

  async function openRound1() {
    if (!closeAtMs || closeAtMs <= Date.now()) throw new DataError('VALIDATION_ERROR', 'Definí una fecha de cierre futura.')
    const electorate = participants.map((m) => m.id)
    if (electorate.length === 0) throw new DataError('VALIDATION_ERROR', 'No hay electores.')
    let opened = 0
    for (const a of openable) {
      const candidates = (a.eligibility === 'VAO' ? vao : participants).map((m) => m.id)
      if (candidates.length === 0) continue
      await db.updateDoc(P.award(slug, a.code), { state: 'ROUND1_OPEN', candidates, electorate, round1: { openAt: Date.now(), closeAt: closeAtMs }, updatedAt: Date.now(), version: a.version + 1 })
      opened++
    }
    await setDecision(db, slug, 'premios', { status: 'VOTING' })
    await pushNews(db, slug, `Abrió la votación de premios (${opened} categorías). Cierra ${fmtDateTime(closeAtMs)}.`)
    await logAudit(db, slug, memberId!, 'awards.open', `${opened} categorías`)
  }

  /** Cierra una categoría: cuenta boletas (sin mostrarlas) y guarda el resultado sellado. */
  async function closeCategory(a: Award, round: 1 | 2) {
    const ballots = await db.getCollection<Ballot>(P.ballots(slug, a.code))
    const electorate = new Set(a.electorate)
    const valid = ballots.filter((b) => electorate.has(b.id))
    const allowed = new Set(round === 1 ? [...a.candidates, NOBODY] : a.finalists ?? [])
    const choices = valid.map((b) => (round === 1 ? b.r1 : b.r2))
    const counts = countBallots(choices, allowed)
    const participation = choices.filter((c) => c && allowed.has(c)).length
    let sealed: SealedResult
    if (round === 1) {
      const r = resolveRound1(counts)
      sealed = { round: 1, counts, outcome: r.outcome, winner: r.winner ?? null, finalists: r.finalists, participation, electorateSize: a.electorate.length, computedAt: Date.now() }
    } else {
      const r = resolveRound2(counts)
      sealed = { round: 2, counts, outcome: r.outcome, winner: r.winner ?? null, tied: r.tied, participation, electorateSize: a.electorate.length, computedAt: Date.now() }
    }
    await db.runTransaction(async (tx) => {
      const cur = await tx.get<Award>(P.award(slug, a.code))
      if (!cur) throw new DataError('NOT_FOUND')
      const expected = round === 1 ? 'ROUND1_OPEN' : 'ROUND2_OPEN'
      if (cur.state !== expected) return
      tx.set(P.sealed(slug, a.code), sealed)
      tx.update(P.award(slug, a.code), { state: sealed.outcome === 'RUNOFF_REQUIRED' ? 'RUNOFF_READY' : 'SEALED', completedCount: participation, updatedAt: Date.now(), version: cur.version + 1 })
    })
    await logAudit(db, slug, memberId!, round === 1 ? 'award.close1' : 'award.close2', a.code)
  }

  async function openRunoffs() {
    if (!closeAtMs || closeAtMs <= Date.now()) throw new DataError('VALIDATION_ERROR', 'Definí una fecha de cierre futura.')
    const ready = list.filter((a) => a.state === 'RUNOFF_READY')
    for (const a of ready) {
      const sealed = await db.getDoc<SealedResult>(P.sealed(slug, a.code))
      if (!sealed?.finalists?.length) continue
      await db.updateDoc(P.award(slug, a.code), { state: 'ROUND2_OPEN', finalists: sealed.finalists, round2: { openAt: Date.now(), closeAt: closeAtMs }, updatedAt: Date.now(), version: a.version + 1 })
    }
    await pushNews(db, slug, `Ballotage abierto en ${ready.length} categorías. Cierra ${fmtDateTime(closeAtMs)}.`)
    await logAudit(db, slug, memberId!, 'awards.runoff', `${ready.length} categorías`)
  }

  async function voidAward(a: Award, reason: string) {
    await db.updateDoc(P.award(slug, a.code), { state: 'VOID', updatedAt: Date.now(), version: a.version + 1 })
    const id = a.code + '-v' + (a.version + 1)
    await db.setDoc(P.award(slug, id), { ...a, code: id, state: 'DRAFT', candidates: [], electorate: [], round1: null, round2: null, finalists: null, result: null, revealedAt: null, version: 1, completedCount: 0, createdAt: Date.now(), updatedAt: Date.now() })
    await logAudit(db, slug, memberId!, 'award.void', a.code, reason)
  }

  async function manualResult(a: Award, winner: string, reason: string) {
    const result: SealedResult = { round: a.state === 'ROUND2_OPEN' || a.round2 ? 2 : 1, counts: {}, outcome: winner === NOBODY ? 'DESERTED' : 'WINNER', winner: winner === NOBODY ? null : winner, participation: 0, electorateSize: a.electorate.length, computedAt: Date.now() }
    await db.setDoc(P.sealed(slug, a.code), { ...result, manual: true, reason } as SealedResult & { manual: boolean; reason: string })
    await db.updateDoc(P.award(slug, a.code), { state: 'SEALED', updatedAt: Date.now(), version: a.version + 1 })
    await logAudit(db, slug, memberId!, 'award.manual', a.code, reason)
  }

  /** Publica el resultado sellado para toda la banda. Una vez revelado no se vuelve a ocultar. */
  async function reveal(a: Award) {
    const sealed = await db.getDoc<SealedResult>(P.sealed(slug, a.code))
    if (!sealed || sealed.outcome === 'RUNOFF_REQUIRED') throw new DataError('STATE_CONFLICT', 'No hay resultado sellado.')
    const result: AwardResult = {
      outcome: sealed.outcome,
      winner: sealed.winner ?? null,
      tied: sealed.tied ?? [],
      counts: sealed.counts,
      round: sealed.round,
      participation: sealed.participation,
      electorateSize: sealed.electorateSize,
      manual: (sealed as SealedResult & { manual?: boolean }).manual ?? false,
    }
    await db.runTransaction(async (tx) => {
      const cur = await tx.get<Award>(P.award(slug, a.code))
      if (!cur) throw new DataError('NOT_FOUND')
      if (cur.state === 'REVEALED') return
      if (cur.state !== 'SEALED') throw new DataError('STATE_CONFLICT', 'La categoría no está sellada.')
      tx.update(P.award(slug, a.code), { state: 'REVEALED', result, revealedAt: Date.now(), updatedAt: Date.now(), version: cur.version + 1 })
    })
    await pushNews(db, slug, `Premio revelado: ${awardTitle(a, edition!.year)}.`)
    await logAudit(db, slug, memberId!, 'award.reveal', a.code)
  }

  async function correctRevealed(a: Award, reason: string) {
    const r: AwardResult = { ...a.result!, corrected: { reason, at: Date.now() } }
    await db.updateDoc(P.award(slug, a.code), { result: r, updatedAt: Date.now(), version: a.version + 1 })
    await logAudit(db, slug, memberId!, 'award.correct', a.code, reason)
  }

  async function refreshCounts() {
    const out: Record<string, number> = {}
    for (const a of list.filter((x) => x.state === 'ROUND1_OPEN' || x.state === 'ROUND2_OPEN')) {
      const ballots = await db.getCollection<Ballot>(P.ballots(slug, a.code))
      out[a.code] = ballots.filter((b) => (a.state === 'ROUND2_OPEN' ? b.r2 : b.r1)).length
    }
    setBallotCounts(out)
  }

  const stateLabel: Record<Award['state'], string> = {
    DRAFT: 'Borrador',
    ROUND1_OPEN: 'Primera ronda abierta',
    ROUND1_CLOSED: 'Primera ronda cerrada',
    RUNOFF_READY: 'Ballotage listo',
    ROUND2_OPEN: 'Ballotage abierto',
    SEALED: 'Sellado',
    REVEALED: 'Revelado',
    VOID: 'Anulado',
  }

  return (
    <div className="grid gap-4">
      {VAO_ACTIVO && !edition.vaoRosterConfirmed ? <Notice tone="warn">Las tres categorías VAO (Viaje Anual Obligatorio) quedan bloqueadas hasta que confirmes en Miembros quiénes fueron al viaje. Ahora hay {vao.length} marcados.</Notice> : null}
      <Card>
        <p className="h3 mb-2">Abrir y cerrar</p>
        <div className="grid grid-cols-[1fr_120px] gap-2 max-w-sm">
          <Field label="Cierre de la ronda" id="aw-close">
            <Input id="aw-close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </Field>
          <Field label="Hora" id="aw-time">
            <Input id="aw-time" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="gold" disabled={openable.length === 0} loading={busy === 'open'} onClick={() => void run('open', openRound1, 'Primera ronda abierta')}>
            Abrir primera ronda ({openable.length} categorías)
          </Button>
          <Button
            disabled={!list.some((a) => a.state === 'ROUND1_OPEN')}
            loading={busy === 'close1'}
            onClick={() =>
              void run('close1', async () => {
                for (const a of list.filter((x) => x.state === 'ROUND1_OPEN')) await closeCategory(a, 1)
              }, 'Primera ronda cerrada y sellada. No se mostró ningún resultado.')
            }
          >
            Cerrar primera ronda
          </Button>
          <Button disabled={!list.some((a) => a.state === 'RUNOFF_READY')} loading={busy === 'runoff'} onClick={() => void run('runoff', openRunoffs, 'Ballotage abierto')}>
            Abrir ballotage ({list.filter((a) => a.state === 'RUNOFF_READY').length}) · {BALLOTAGE_HORAS} h sugeridas
          </Button>
          <Button
            disabled={!list.some((a) => a.state === 'ROUND2_OPEN')}
            loading={busy === 'close2'}
            onClick={() =>
              void run('close2', async () => {
                for (const a of list.filter((x) => x.state === 'ROUND2_OPEN')) await closeCategory(a, 2)
              }, 'Ballotage cerrado y sellado.')
            }
          >
            Cerrar ballotage
          </Button>
          <Button size="sm" variant="line" onClick={() => void refreshCounts()}>
            Ver cuántos votaron
          </Button>
          <Button size="sm" variant="line" onClick={() => setCloseDate(new Date(hoursFromNow(BALLOTAGE_HORAS) - 3 * 3600000).toISOString().slice(0, 10))}>
            Cierre en {BALLOTAGE_HORAS} h
          </Button>
        </div>
        <p className="tiny muted mt-3">Al cerrar, el conteo corre en tu navegador y se guarda sellado sin mostrarse. Cuando quieras anunciarlo, tocá Revelar en cada categoría: ahí recién lo ve la banda en Premios. Para espiar antes, usá el acceso reservado.</p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <p className="h3">Categorías</p>
          <span className="flex gap-2">
            <Input placeholder="Nueva categoría" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} aria-label="Nueva categoría" />
            <Button
              size="sm"
              variant="line"
              disabled={newLabel.trim().length < 2}
              onClick={() =>
                void run('new', async () => {
                  const code = newLabel.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_')
                  if (awards.some((a) => a.code === code)) throw new DataError('VALIDATION_ERROR', 'Ya existe.')
                  const a: Award = { code, label: newLabel.trim(), description: '', eligibility: 'EDITION', order: list.length + 1, enabled: true, state: 'DRAFT', candidates: [], electorate: [], round1: null, round2: null, finalists: null, result: null, revealedAt: null, version: 1, completedCount: 0, createdAt: Date.now(), updatedAt: Date.now() }
                  await db.setDoc(P.award(slug, code), a)
                  setNewLabel('')
                })
              }
            >
              Agregar
            </Button>
          </span>
        </div>
        {list.map((a) => (
          <div key={a.code} className="row items-start">
            <div className="small">
              <p className="font-semibold">
                {awardTitle(a, edition.year)} {!a.enabled ? <Pill tone="muted" className="ml-1">Desactivada</Pill> : null} {a.eligibility === 'VAO' ? <Pill className="ml-1">VAO</Pill> : null}
              </p>
              <p className="tiny muted">
                {stateLabel[a.state]}
                {a.state === 'ROUND1_OPEN' && a.round1 ? ` · ${timeLeft(a.round1.closeAt)}` : ''}
                {a.state === 'ROUND2_OPEN' && a.round2 ? ` · ${timeLeft(a.round2.closeAt)}` : ''}
                {ballotCounts[a.code] !== undefined ? ` · votaron ${ballotCounts[a.code]} de ${a.electorate.length}` : ''}
                {a.state === 'ROUND2_OPEN' && a.finalists ? ` · finalistas: ${a.finalists.map(members.aliasOf).join(', ')}` : ''}
              </p>
              {reserved[a.code] ? (
                <p className="tiny text-warn mt-1">
                  Reservado: {reserved[a.code].outcome}
                  {reserved[a.code].winner ? ` · ${members.aliasOf(reserved[a.code].winner!)}` : ''}
                  {reserved[a.code].tied?.length ? ` · ${reserved[a.code].tied!.map(members.aliasOf).join(' / ')}` : ''}
                  {' · '}
                  {Object.entries(reserved[a.code].counts)
                    .map(([k, n]) => `${members.aliasOf(k)} ${n}`)
                    .join(', ')}
                </p>
              ) : null}
            </div>
            <span className="flex gap-1 flex-wrap justify-end">
              {a.state === 'DRAFT' ? (
                <>
                  <Button size="sm" variant="line" onClick={() => { setEditing(a); setLabel(a.label); setDescription(a.description) }}>
                    Editar
                  </Button>
                  <Button size="sm" variant="line" onClick={() => void db.updateDoc(P.award(slug, a.code), { enabled: !a.enabled, updatedAt: Date.now() })}>
                    {a.enabled ? 'Desactivar' : 'Activar'}
                  </Button>
                </>
              ) : null}
              {a.state === 'ROUND1_OPEN' || a.state === 'ROUND2_OPEN' ? (
                <>
                  <Button size="sm" variant="line" loading={busy === a.code} onClick={() => void run(a.code, () => closeCategory(a, a.state === 'ROUND2_OPEN' ? 2 : 1), 'Categoría cerrada y sellada')}>
                    Cerrar sólo esta
                  </Button>
                  <Button size="sm" variant="line" onClick={() => setVoidTarget(a)}>
                    Anular
                  </Button>
                </>
              ) : null}
              {a.state === 'SEALED' ? (
                <Button size="sm" variant="gold" onClick={() => setRevealTarget(a)}>
                  Revelar
                </Button>
              ) : null}
              {a.state === 'SEALED' || a.state === 'RUNOFF_READY' || a.state === 'ROUND1_CLOSED' ? (
                <Button size="sm" variant="line" onClick={() => setReservedTarget(a)}>
                  Acceso reservado
                </Button>
              ) : null}
              {a.state !== 'REVEALED' && a.state !== 'VOID' && a.state !== 'DRAFT' ? (
                <Button size="sm" variant="line" onClick={() => { setManualTarget(a); setManualWinner('') }}>
                  Resultado manual
                </Button>
              ) : null}
              {a.state === 'REVEALED' ? (
                <Button size="sm" variant="line" onClick={() => setVoidTarget(a)}>
                  Registrar corrección
                </Button>
              ) : null}
            </span>
          </div>
        ))}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar categoría">
        <Field label="Nombre" id="aw-label">
          <Input id="aw-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Descripción" id="aw-desc">
          <Textarea id="aw-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button
          variant="gold"
          onClick={() =>
            void run('edit', async () => {
              await db.updateDoc(P.award(slug, editing!.code), { label: label.trim(), description: description.trim(), updatedAt: Date.now() })
              setEditing(null)
            }, 'Guardado')
          }
        >
          Guardar
        </Button>
      </Modal>

      <ConfirmDialog
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        title={voidTarget?.state === 'REVEALED' ? 'Registrar corrección' : 'Anular categoría'}
        text={voidTarget?.state === 'REVEALED' ? 'El resultado ya se vio: no se oculta. Se muestra "Resultado corregido" con el motivo.' : 'Se anula esta versión (las boletas quedan archivadas) y se crea una nueva en borrador.'}
        requireReason
        danger
        confirmLabel={voidTarget?.state === 'REVEALED' ? 'Registrar' : 'Anular'}
        onConfirm={async (reason) => {
          const t = voidTarget!
          await run('void', () => (t.state === 'REVEALED' ? correctRevealed(t, reason) : voidAward(t, reason)), 'Hecho')
          setVoidTarget(null)
        }}
      />

      <Modal open={!!manualTarget} onClose={() => setManualTarget(null)} title="Resolución del administrador">
        <p className="small muted mb-3">Resultado extraordinario. Se muestra siempre con la marca "Resolución del administrador". Reemplaza el escrutinio de esta categoría.</p>
        <Field label="Ganador" id="man-w">
          <select id="man-w" className="input" value={manualWinner} onChange={(e) => setManualWinner(e.target.value)}>
            <option value="">Elegí</option>
            {(manualTarget?.candidates.length ? manualTarget.candidates : participants.map((m) => m.id)).map((id) => (
              <option key={id} value={id}>
                {members.aliasOf(id)}
              </option>
            ))}
            <option value={NOBODY}>Desierto</option>
          </select>
        </Field>
        <Field label="Motivo" id="man-r">
          <Textarea id="man-r" />
        </Field>
        <Button
          variant="danger"
          disabled={!manualWinner}
          onClick={() => {
            const reason = (document.getElementById('man-r') as HTMLTextAreaElement)?.value.trim()
            if (!reason) {
              toast.error('Indicá el motivo.')
              return
            }
            void run('manual', async () => {
              await manualResult(manualTarget!, manualWinner, reason)
              setManualTarget(null)
            }, 'Resultado manual sellado')
          }}
        >
          Sellar resultado manual
        </Button>
      </Modal>

      <ConfirmDialog
        open={!!revealTarget}
        onClose={() => setRevealTarget(null)}
        title={`Revelar ${revealTarget ? awardTitle(revealTarget, edition.year) : ''}`}
        text="El resultado se publica para toda la banda en Premios. No se puede volver a ocultar; si hubiera un error, se registra una corrección."
        confirmLabel="Revelar ahora"
        loading={busy === 'reveal'}
        onConfirm={async () => {
          const t = revealTarget!
          await run('reveal', () => reveal(t), 'Revelado')
          setRevealTarget(null)
        }}
      />
      <ConfirmDialog
        open={!!reservedTarget}
        onClose={() => setReservedTarget(null)}
        title="Acceso reservado"
        text="Vas a ver el resultado sellado y el recuento antes de la ceremonia. Queda registrado con tu motivo."
        requireReason
        confirmLabel="Ver"
        onConfirm={async (reason) => {
          const t = reservedTarget!
          const s = await db.getDoc<SealedResult>(P.sealed(slug, t.code))
          await logAudit(db, slug, memberId!, 'reserved.read', `award:${t.code}`, reason)
          if (s) setReserved((r) => ({ ...r, [t.code]: s }))
          setReservedTarget(null)
        }}
      />
    </div>
  )
}
