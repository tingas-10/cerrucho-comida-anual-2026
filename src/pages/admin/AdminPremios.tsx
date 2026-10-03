// Premios (administración): categorías, período de votación (abre y cierra cuando Agus define),
// conteo y resultados. Los resultados los ve SOLO Agus y nunca se publican en la web.
import { useMemo, useState } from 'react'
import { BALLOTAGE_HORAS } from '../../content/config'
import { NOBODY, VAO_ACTIVO } from '../../content/premios'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit, pushNews, setDecision } from '../../data/actions'
import { DataError } from '../../data/adapter'
import { useCollection, useDocs, useEdition, useMembers, useNow } from '../../data/hooks'
import { P } from '../../data/paths'
import type { Award, Ballot, SealedResult } from '../../data/types'
import { countBallots, resolveRound1, resolveRound2 } from '../../domain/awards'
import { fmtDateTime, localToMs, msToLocalParts, timeLeft } from '../../domain/format'
import { Button, Card, ConfirmDialog, Field, Input, Loading, Modal, Notice, Pill, Textarea } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { awardPhase, awardTitle } from '../Premios'

function nowParts(offsetMs = 0) {
  return msToLocalParts(Date.now() + offsetMs)
}

export function AdminPremios() {
  const { db, slug, memberId, isAgus } = useSession()
  const toast = useToast()
  const now = useNow()
  const { data: edition } = useEdition()
  const members = useMembers()
  const { rows: awards } = useCollection<Award>(P.awards(slug))
  const list = useMemo(() => awards.filter((a) => VAO_ACTIVO || a.eligibility !== 'VAO').sort((a, b) => a.order - b.order), [awards])
  const counted = list.filter((a) => a.state === 'SEALED' || a.state === 'RUNOFF_READY' || a.state === 'ROUND1_CLOSED')
  const { docs: sealedDocs } = useDocs<SealedResult & { manual?: boolean; reason?: string }>(isAgus ? counted.map((a) => P.sealed(slug, a.code)) : [])
  const [busy, setBusy] = useState<string | null>(null)
  const start0 = nowParts()
  const end0 = nowParts(BALLOTAGE_HORAS * 3600000)
  const [openDate, setOpenDate] = useState(start0.date)
  const [openTime, setOpenTime] = useState(start0.time)
  const [closeDate, setCloseDate] = useState(end0.date)
  const [closeTime, setCloseTime] = useState('23:59')
  const [editing, setEditing] = useState<Award | null>(null)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [voidTarget, setVoidTarget] = useState<Award | null>(null)
  const [manualTarget, setManualTarget] = useState<Award | null>(null)
  const [manualWinner, setManualWinner] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [ballotCounts, setBallotCounts] = useState<Record<string, number>>({})

  if (!edition) return <Loading />
  const participants = members.active.filter((m) => m.participating)
  const vao = participants.filter((m) => m.vao)
  const drafts = list.filter((a) => a.enabled && a.state === 'DRAFT')
  const openable = drafts.filter((a) => a.eligibility !== 'VAO' || (edition.vaoRosterConfirmed && vao.length > 0))
  const openAtMs = localToMs(openDate, openTime)
  const closeAtMs = localToMs(closeDate, closeTime)
  const voting = list.filter((a) => a.state === 'ROUND1_OPEN' || a.state === 'ROUND2_OPEN')

  function checkWindow() {
    if (!openAtMs || !closeAtMs) throw new DataError('VALIDATION_ERROR', 'Completá cuándo abre y cuándo cierra.')
    if (closeAtMs <= openAtMs) throw new DataError('VALIDATION_ERROR', 'El cierre tiene que ser después de la apertura.')
    if (closeAtMs <= Date.now()) throw new DataError('VALIDATION_ERROR', 'El cierre tiene que ser en el futuro.')
  }

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
    checkWindow()
    const electorate = participants.map((m) => m.id)
    if (electorate.length === 0) throw new DataError('VALIDATION_ERROR', 'No hay miembros activos para votar.')
    let opened = 0
    for (const a of openable) {
      const candidates = (a.eligibility === 'VAO' ? vao : participants).map((m) => m.id)
      if (candidates.length === 0) continue
      await db.updateDoc(P.award(slug, a.code), { state: 'ROUND1_OPEN', candidates, electorate, round1: { openAt: openAtMs, closeAt: closeAtMs }, updatedAt: Date.now(), version: a.version + 1 })
      opened++
    }
    await setDecision(db, slug, 'premios', { status: 'VOTING' })
    await pushNews(db, slug, `Votación de premios: abre ${fmtDateTime(openAtMs)} y cierra ${fmtDateTime(closeAtMs)}.`)
    await logAudit(db, slug, memberId!, 'awards.open', `${opened} categorías`)
  }

  /** Cambia el período de las categorías que están en votación (para extender o adelantar). */
  async function changeWindow() {
    checkWindow()
    for (const a of voting) {
      const field = a.state === 'ROUND2_OPEN' ? 'round2' : 'round1'
      await db.updateDoc(P.award(slug, a.code), { [field]: { openAt: openAtMs, closeAt: closeAtMs }, updatedAt: Date.now(), version: a.version + 1 })
    }
    await logAudit(db, slug, memberId!, 'awards.window', `${fmtDateTime(openAtMs)} → ${fmtDateTime(closeAtMs)}`)
  }

  /** Cuenta las boletas y guarda el resultado sellado (sólo Agus lo puede leer). */
  async function closeCategory(a: Award, round: 1 | 2) {
    const ballots = await db.getCollection<Ballot>(P.ballots(slug, a.code))
    const electorate = new Set(a.electorate)
    const valid = ballots.filter((b) => electorate.has(b.id))
    const allowed = new Set(round === 1 ? [...a.candidates, NOBODY] : (a.finalists ?? []))
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
      if (cur.state !== (round === 1 ? 'ROUND1_OPEN' : 'ROUND2_OPEN')) return
      tx.set(P.sealed(slug, a.code), sealed)
      tx.update(P.award(slug, a.code), { state: sealed.outcome === 'RUNOFF_REQUIRED' ? 'RUNOFF_READY' : 'SEALED', updatedAt: Date.now(), version: cur.version + 1 })
    })
    await logAudit(db, slug, memberId!, round === 1 ? 'award.count1' : 'award.count2', a.code)
  }

  async function openRunoffs() {
    checkWindow()
    const ready = list.filter((a) => a.state === 'RUNOFF_READY')
    for (const a of ready) {
      const sealed = await db.getDoc<SealedResult>(P.sealed(slug, a.code))
      if (!sealed?.finalists?.length) continue
      await db.updateDoc(P.award(slug, a.code), { state: 'ROUND2_OPEN', finalists: sealed.finalists, round2: { openAt: openAtMs, closeAt: closeAtMs }, updatedAt: Date.now(), version: a.version + 1 })
    }
    await pushNews(db, slug, `Ballotage de premios: abre ${fmtDateTime(openAtMs)} y cierra ${fmtDateTime(closeAtMs)}.`)
    await logAudit(db, slug, memberId!, 'awards.runoff', `${ready.length} categorías`)
  }

  async function voidAward(a: Award, reason: string) {
    await db.updateDoc(P.award(slug, a.code), { state: 'VOID', updatedAt: Date.now(), version: a.version + 1 })
    const id = a.code + '-v' + (a.version + 1)
    await db.setDoc(P.award(slug, id), { ...a, code: id, state: 'DRAFT', candidates: [], electorate: [], round1: null, round2: null, finalists: null, result: null, revealedAt: null, version: 1, completedCount: 0, createdAt: Date.now(), updatedAt: Date.now() })
    await logAudit(db, slug, memberId!, 'award.void', a.code, reason)
  }

  async function manualResult(a: Award, winner: string, reason: string) {
    const result: SealedResult = { round: a.round2 ? 2 : 1, counts: {}, outcome: winner === NOBODY ? 'DESERTED' : 'WINNER', winner: winner === NOBODY ? null : winner, participation: 0, electorateSize: a.electorate.length, computedAt: Date.now() }
    await db.setDoc(P.sealed(slug, a.code), { ...result, manual: true, reason } as SealedResult & { manual: boolean; reason: string })
    await db.updateDoc(P.award(slug, a.code), { state: 'SEALED', updatedAt: Date.now(), version: a.version + 1 })
    await logAudit(db, slug, memberId!, 'award.manual', a.code, reason)
  }

  async function refreshCounts() {
    const out: Record<string, number> = {}
    for (const a of voting) {
      const ballots = await db.getCollection<Ballot>(P.ballots(slug, a.code))
      out[a.code] = ballots.filter((b) => (a.state === 'ROUND2_OPEN' ? b.r2 : b.r1)).length
    }
    setBallotCounts(out)
  }

  const stateLabel = (a: Award): string => {
    const ph = awardPhase(a, now)
    switch (a.state) {
      case 'DRAFT':
        return 'Sin abrir'
      case 'ROUND1_OPEN':
      case 'ROUND2_OPEN':
        return (a.state === 'ROUND2_OPEN' ? 'Ballotage · ' : '') + (ph.phase === 'scheduled' ? `abre ${fmtDateTime(ph.openAt)}` : ph.phase === 'open' ? timeLeft(ph.closeAt, now) : 'cerró, falta contar')
      case 'RUNOFF_READY':
        return 'Contada · necesita ballotage'
      case 'SEALED':
        return 'Contada'
      case 'VOID':
        return 'Anulada'
      default:
        return a.state
    }
  }

  const resultText = (s: SealedResult | null | undefined): string => {
    if (!s) return '…'
    if (s.outcome === 'WINNER' && s.winner) return `Ganó ${members.aliasOf(s.winner)}`
    if (s.outcome === 'TIE') return `Empate: ${(s.tied ?? []).map(members.aliasOf).join(' / ')}`
    if (s.outcome === 'DESERTED') return 'Desierto (ganó "Nadie lo merece")'
    if (s.outcome === 'NO_VOTES') return 'Sin votos'
    if (s.outcome === 'RUNOFF_REQUIRED') return `Va a ballotage: ${(s.finalists ?? []).map(members.aliasOf).join(', ')}`
    return s.outcome
  }

  return (
    <div className="grid gap-4">
      <Notice>
        Los resultados <b>no se publican nunca</b>: los ves sólo vos (con tu usuario) y los anunciás en la comida. La banda ve únicamente si la votación está abierta y su propio voto.
      </Notice>
      {!isAgus ? <Notice tone="warn">Contar votos y ver resultados es sólo para Agus.</Notice> : null}

      <Card>
        <p className="h3 mb-1">Período de votación</p>
        <p className="tiny muted mb-3">Fuera de este período no se aceptan votos ni cambios.</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Abre el" id="aw-od">
            <Input id="aw-od" type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
          </Field>
          <Field label="a las" id="aw-ot">
            <Input id="aw-ot" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
          </Field>
          <Field label="Cierra el" id="aw-cd">
            <Input id="aw-cd" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </Field>
          <Field label="a las" id="aw-ct">
            <Input id="aw-ct" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="gold" disabled={openable.length === 0} loading={busy === 'open'} onClick={() => void run('open', openRound1, 'Votación programada')}>
            Programar votación ({openable.length} categorías)
          </Button>
          {voting.length ? (
            <Button variant="line" loading={busy === 'window'} onClick={() => void run('window', changeWindow, 'Período actualizado')}>
              Cambiar período de las abiertas ({voting.length})
            </Button>
          ) : null}
          {isAgus && list.some((a) => a.state === 'RUNOFF_READY') ? (
            <Button variant="line" loading={busy === 'runoff'} onClick={() => void run('runoff', openRunoffs, 'Ballotage programado')}>
              Abrir ballotage ({list.filter((a) => a.state === 'RUNOFF_READY').length})
            </Button>
          ) : null}
        </div>
        {list.some((a) => a.state === 'RUNOFF_READY') ? (
          <p className="tiny text-warn mt-2">Ojo: al abrir el ballotage, la banda ve quiénes son los finalistas de esa categoría (no los votos). Si preferís no dar esa pista, podés cargar un resultado manual.</p>
        ) : null}
      </Card>

      {isAgus && voting.length ? (
        <Card>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <p className="h3">En votación</p>
            <Button size="sm" variant="line" onClick={() => void refreshCounts()}>
              Ver cuántos votaron
            </Button>
          </div>
          {voting.map((a) => {
            const ph = awardPhase(a, now)
            return (
              <div key={a.code} className="row">
                <span className="small">
                  <b>{awardTitle(a, edition.year)}</b>
                  <span className="tiny muted block">
                    {stateLabel(a)}
                    {ballotCounts[a.code] !== undefined ? ` · votaron ${ballotCounts[a.code]} de ${a.electorate.length}` : ''}
                  </span>
                </span>
                <Button size="sm" variant={ph.phase === 'closed' ? 'gold' : 'line'} loading={busy === a.code} onClick={() => void run(a.code, () => closeCategory(a, a.state === 'ROUND2_OPEN' ? 2 : 1), 'Votos contados')}>
                  {ph.phase === 'closed' ? 'Contar votos' : 'Cerrar y contar'}
                </Button>
              </div>
            )
          })}
        </Card>
      ) : null}

      {isAgus && counted.length ? (
        <Card className="border-accent">
          <p className="h3">Resultados</p>
          <p className="tiny muted mb-2">Sólo vos ves esto.</p>
          {counted.map((a) => {
            const s = sealedDocs[P.sealed(slug, a.code)]
            return (
              <details key={a.code} className="py-2 border-b border-line last:border-0">
                <summary className="cursor-pointer min-h-[40px]">
                  <b>{awardTitle(a, edition.year)}</b>: {resultText(s)}
                  {s?.manual ? <Pill tone="muted" className="ml-2">Manual</Pill> : null}
                </summary>
                {s ? (
                  <div className="mt-2 small">
                    <p className="tiny muted">
                      Votaron {s.participation} de {s.electorateSize} · ronda {s.round}
                      {s.manual && s.reason ? ` · ${s.reason}` : ''}
                    </p>
                    {Object.entries(s.counts)
                      .sort((x, y) => y[1] - x[1])
                      .map(([k, n]) => (
                        <div key={k} className="flex justify-between py-1 border-t border-line">
                          <span>{members.aliasOf(k)}</span>
                          <b>{n}</b>
                        </div>
                      ))}
                  </div>
                ) : null}
              </details>
            )
          })}
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <p className="h3">Categorías</p>
        </div>
        {list.map((a) => (
          <div key={a.code} className="py-2 border-b border-line last:border-0">
            <div className="flex items-start justify-between gap-2">
              <div className="small min-w-0">
                <p className="font-semibold">
                  {awardTitle(a, edition.year)} {!a.enabled ? <Pill tone="muted">Desactivada</Pill> : null}
                </p>
                <p className="tiny muted">{stateLabel(a)}</p>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap mt-1">
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
              {a.state !== 'VOID' && a.state !== 'DRAFT' ? (
                <>
                  {isAgus ? (
                    <Button size="sm" variant="line" onClick={() => { setManualTarget(a); setManualWinner(''); setManualReason('') }}>
                      Resultado manual
                    </Button>
                  ) : null}
                  <Button size="sm" variant="line" onClick={() => setVoidTarget(a)}>
                    Anular y rehacer
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ))}
        <div className="flex gap-2 mt-3">
          <Input placeholder="Nueva categoría" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} aria-label="Nueva categoría" />
          <Button
            variant="line"
            disabled={newLabel.trim().length < 2}
            onClick={() =>
              void run('new', async () => {
                const code = newLabel.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_')
                if (awards.some((a) => a.code === code)) throw new DataError('VALIDATION_ERROR', 'Ya existe.')
                const a: Award = { code, label: newLabel.trim(), description: '', eligibility: 'EDITION', order: list.length + 1, enabled: true, state: 'DRAFT', candidates: [], electorate: [], round1: null, round2: null, finalists: null, result: null, revealedAt: null, version: 1, completedCount: 0, createdAt: Date.now(), updatedAt: Date.now() }
                await db.setDoc(P.award(slug, code), a)
                setNewLabel('')
              }, 'Categoría agregada')
            }
          >
            Agregar
          </Button>
        </div>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar categoría">
        <Field label="Nombre" id="aw-label">
          <Input id="aw-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Descripción" id="aw-desc">
          <Textarea id="aw-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button variant="gold" onClick={() => void run('edit', async () => { await db.updateDoc(P.award(slug, editing!.code), { label: label.trim(), description: description.trim(), updatedAt: Date.now() }); setEditing(null) }, 'Guardado')}>
          Guardar
        </Button>
      </Modal>

      <ConfirmDialog
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        title="Anular y rehacer categoría"
        text="Se anula esta votación (los votos quedan guardados aparte) y se crea la categoría de nuevo sin abrir."
        requireReason
        danger
        confirmLabel="Anular"
        onConfirm={async (reason) => {
          const t = voidTarget!
          await run('void', () => voidAward(t, reason), 'Anulada')
          setVoidTarget(null)
        }}
      />

      <Modal open={!!manualTarget} onClose={() => setManualTarget(null)} title="Resultado manual">
        <p className="small muted mb-3">Reemplaza el conteo de esta categoría. Queda marcado como manual. Tampoco se publica.</p>
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
          <Textarea id="man-r" value={manualReason} onChange={(e) => setManualReason(e.target.value)} />
        </Field>
        <Button
          variant="danger"
          disabled={!manualWinner || !manualReason.trim()}
          onClick={() =>
            void run('manual', async () => {
              await manualResult(manualTarget!, manualWinner, manualReason.trim())
              setManualTarget(null)
            }, 'Resultado manual guardado')
          }
        >
          Guardar resultado manual
        </Button>
      </Modal>
    </div>
  )
}
